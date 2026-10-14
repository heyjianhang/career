"""Transfer tested desktop artifacts to a draft; never publish a release or tag.
Public verification downloads without authentication and hashes the full response.
"""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import urllib.request

REPO = os.environ['GH_REPO']
RUN = os.environ['BUILD_RUN']
SHA = os.environ['SOURCE_SHA']
TAG = os.environ['RELEASE_TAG']
MODE = os.environ['RELEASE_MODE']
VARIANTS = {'mac-arm64': 'dmg', 'mac-x64': 'dmg', 'win-x64': 'exe', 'win-arm64': 'exe'}

def gh(*args):
    return subprocess.check_output(['gh', *args], text=True).strip()

def api(endpoint):
    return json.loads(gh('api', f'repos/{REPO}/{endpoint}'))

def require(condition, message):
    if not condition:
        raise RuntimeError(message)

def validate():
    require(REPO == 'heyjianhang/career', 'Unexpected repository')
    require(RUN.isdigit() and re.fullmatch(r'[0-9a-f]{40}', SHA), 'Invalid run/SHA')
    require(re.fullmatch(r'desktop-v\d+\.\d+\.\d+-[a-z0-9.]+', TAG), 'Expected prerelease desktop tag')
    require(MODE in ['stage-draft', 'verify-public'], 'Invalid release mode')
    build = api(f'actions/runs/{RUN}')
    require(build['head_sha'] == SHA and build['head_branch'] == 'main', 'Build must match the selected main commit')
    require(build['conclusion'] == 'success' and build['status'] == 'completed', 'Build not successful')
    require(build['path'] == '.github/workflows/desktop.yml', 'Wrong source workflow')
    release = json.loads(gh('release', 'view', TAG, '--json', 'databaseId,tagName,targetCommitish,isDraft,isPrerelease,assets'))
    require(release['targetCommitish'] == SHA and release['tagName'] == TAG, 'Release target differs from built source')
    require(release['isPrerelease'], 'Only desktop prereleases are supported')
    require(release['isDraft'] == (MODE == 'stage-draft'), 'Unexpected release publication state')
    return release

def digest_file(path):
    with open(path, 'rb') as stream:
        checksum = hashlib.sha256()
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            checksum.update(block)
        return checksum.hexdigest()

def execute():
    release = validate()
    version = TAG.removeprefix('desktop-v')
    output = Path('release-output')
    output.mkdir(exist_ok=True)
    evidence = {'source_sha': SHA, 'build_run': RUN, 'tag': TAG, 'mode': MODE, 'assets': []}
    if MODE == 'stage-draft':
        # Verify every native smoke result and every installer before changing the draft.
        selected = []
        for variant, ext in VARIANTS.items():
            reports = list(Path(f'release-input/career-smoke-{variant}').rglob('report.json'))
            require(len(reports) == 1 and json.loads(reports[0].read_text())['ok'] is True, f'{variant}: smoke failed/missing')
            folder = Path(f'release-input/career-{variant}')
            name = f'career-{version}-{variant}.{ext}'
            files = list(folder.rglob(name))
            require(len(files) == 1, f'{variant}: installer missing/ambiguous')
            sums = list(folder.rglob(f'SHA256SUMS-{variant}.txt'))
            require(len(sums) == 1, f'{variant}: checksum missing')
            expected = {line.split(maxsplit=1)[1].strip(): line.split()[0] for line in sums[0].read_text().splitlines()}
            digest = digest_file(files[0])
            require(expected.get(name) == digest, f'{variant}: checksum mismatch')
            selected.append((files[0], {'name': name, 'sha256': digest, 'bytes': files[0].stat().st_size}))
        for file, item in selected:
            gh('release', 'upload', TAG, str(file), '--clobber')
            evidence['assets'].append(item)
        sums_path = output / 'SHA256SUMS.txt'
        sums_path.write_text(''.join(f"{item['sha256']}  {item['name']}\n" for item in evidence['assets']))
        gh('release', 'upload', TAG, str(sums_path), '--clobber')
        remote = {item['name']: item for item in api(f"releases/{release['databaseId']}/assets")}
        for item in evidence['assets']:
            actual = remote[item['name']]
            require(actual['digest'] == 'sha256:' + item['sha256'] and actual['size'] == item['bytes'], 'Remote upload checksum mismatch')
    else:
        remote = {item['name']: item for item in api(f"releases/{release['databaseId']}/assets")}
        for variant, ext in VARIANTS.items():
            name = f'career-{version}-{variant}.{ext}'
            asset = remote[name]
            url = f'https://github.com/{REPO}/releases/download/{TAG}/{name}'
            require(asset['browser_download_url'] == url, 'Unexpected download URL')
            checksum, size = hashlib.sha256(), 0
            # urllib does not read GH_TOKEN; no Authorization header or cookie is sent.
            request = urllib.request.Request(url, headers={'User-Agent': 'career-release-verification'})
            with urllib.request.urlopen(request, timeout=120) as response:
                require(response.status == 200, 'Public download failed')
                while block := response.read(1024 * 1024):
                    checksum.update(block)
                    size += len(block)
            require(asset['digest'] == 'sha256:' + checksum.hexdigest() and size == asset['size'], 'Public checksum mismatch')
            evidence['assets'].append({'name': name, 'url': url, 'sha256': checksum.hexdigest(), 'bytes': size, 'http_status': 200, 'anonymous': True})
    (output / 'verification.json').write_text(json.dumps(evidence, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(evidence, ensure_ascii=False, indent=2))

if __name__ == '__main__':
    if sys.argv[1:] == ['validate']:
        validate()
    elif sys.argv[1:] == ['execute']:
        execute()
    else:
        raise SystemExit('Expected validate or execute')
