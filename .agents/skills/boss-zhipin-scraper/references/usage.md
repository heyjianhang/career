# 环境与命令

从个人工作区执行。脚本位于 `.agents/skills/boss-zhipin-scraper/scripts/`；以当前工作区的实际绝对路径解析，不用 shell 的 `$0` 或开发者机器路径定位。

## 首次准备

先找到 Python 3.10+：macOS／Linux 可检查 python3、python3.12 等已有解释器；Windows 检查 `py -3 --version` 或 `python --version`。实际执行版本检查，macOS 自带 python3 可能太旧。没有可用版本时，按当前系统从 [Python 官方网站](https://www.python.org/downloads/) 引导安装；已有 uv 环境可复用，不为此强制安装另一个包管理器。

创建独立虚拟环境到当前工作区 `.local/boss-zhipin-scraper/venv`，依赖仅为随包 requirements 中的 requests 和 websocket-client。以下 `python3`／`py -3` 需替换为前面核对过的解释器；不使用 sudo pip 或改系统 Python。

macOS／Linux：

```sh
python3 -m venv .local/boss-zhipin-scraper/venv
.local/boss-zhipin-scraper/venv/bin/python -m pip install -r .agents/skills/boss-zhipin-scraper/requirements.txt
.local/boss-zhipin-scraper/venv/bin/python -B .agents/skills/boss-zhipin-scraper/scripts/boss_cdp_raw.py --help
```

Windows PowerShell：

```powershell
py -3 -m venv .local/boss-zhipin-scraper/venv
& .\.local\boss-zhipin-scraper\venv\Scripts\python.exe -m pip install -r .agents/skills/boss-zhipin-scraper/requirements.txt
& .\.local\boss-zhipin-scraper\venv\Scripts\python.exe -B .\.agents\skills\boss-zhipin-scraper\scripts\boss_cdp_raw.py --help
```

重复使用先验证虚拟环境版本和 `import requests, websocket`，已满足便复用。换电脑后重建本机环境，不同步 venv。依赖安装失败时保留错误，不把脚本已存在说成已经可运行。

后文 `<Python>` 指上述虚拟环境的解释器，`<采集脚本>` 指 boss_cdp_raw.py 的真实路径；Windows 调用带空格的可执行路径用 PowerShell `&`，参数分别传入。这些是占位说明，不能原样执行。

## 浏览器与登录

脚本支持 Chrome／Chromium 和 Edge。缺少浏览器时从其官方渠道准备，不把 career 的 PDF 浏览器当作用户登录浏览器。启动：

```text
<Python> -B <采集脚本> --setup-chrome --cdp-port 9222
```

使用 Edge 时改为 `--setup-edge`。默认独立目录在用户主目录 `.boss-zhipin-scraper/chrome-profile`；Chrome 和 Edge 共用该路径，选定一个浏览器复用，不交替覆盖。首次由用户在窗口登录；不要索要密码、验证码或 Cookie。

启动会等待登录，成功后浏览器保留运行。已有本 Skill 浏览器且需要诊断时可运行 `--check --cdp-port 9222`；此检查会访问 BOSS，不是离线健康检查，不重复轮询。端口冲突先核对进程归属，必要时另选端口并让后续命令一致；不终止未知进程。

不使用 `--copy-login-state`、`--reset-chrome-profile` 或 `--stop-chrome` 作为常规初始化步骤。需要用户介入的验证出现后停止本次采集。

## 搜索与详情

为每轮建立 `.local/boss-zhipin-scraper/runs/<唯一标识>/`，用下列命令的真实参数替换占位符。关键词和城市来自本轮用户需求。

```text
<Python> -B <采集脚本> --keyword <关键词> --city <城市> --pages 1 --no-detail --output <本轮目录>/jobs.json
```

可选筛选字段 `--salary`、`--experience`、`--degree`、`--scale`、`--stage`、`--industry` 使用代码；以随包脚本的 `--help` 为准，不从旧文档猜枚举。城市可以中文名或代码；抓取数量以实际响应为准，不承诺每页固定 30 条。

从 jobs.json 中挑选本轮需要的岗位，把原 metadata 与选中 jobs 原样保存为 selected.json，更新 total，不删 job_id、job_link、security_id、lid 等详情上下文；这些中间文件只保留在本机。之后：

```text
<Python> -B <采集脚本> --input <本轮目录>/selected.json --detail --max-details 3 --detail-output <本轮目录>/details.json
```

需要 CSV 时追加 `--format csv`。不传 `--max-details` 会抓全部详情；`--max-details 0` 也不会关闭详情，关闭必须用 `--no-detail`。

已抓结果可离线生成摘要：

```text
<Python> -B <Skill目录>/scripts/job_summary.py --input <本轮目录>/jobs.json --details <本轮目录>/details.json --top 10
```

没有详情时，创建本轮内容为 `[]` 的空详情 JSON 并显式传给 `--details`，说明仅统计列表。省略该参数会自动寻找历史详情，可能混入其他轮次；不能用“最新文件”代替本轮实际结果。显式 `--details` 指向不存在的文件会报错，不能用空路径假装有详情。

每轮目录独立时，新增比较需显式 `--diff-base <选定历史jobs.json>`；先核对关键词、城市、筛选和采集时间可比。无基准全标新增只是第一次见到，不代表今日发布。

## 验收与停止

查看命令输出和保存文件，不仅看退出码；核对本次请求范围、列表数量、详情数量、原链接及正文。薪资缺失可能是字段变化或登录限制，不能反复要求用户扫码来“修复”。验证页面、频率限制、连接异常或异常空结果都应停下来核对；不使用代理轮换、指纹伪造或验证码绕过。

没有联网验收时只报告安装与离线检查通过。需要入库再读 [映射与写回](career-import.md)。
