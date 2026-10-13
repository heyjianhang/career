import {escape} from './escape.js';
import type {Contact, WebLink} from './types.js';

/** Only explicit public web URLs become actions; prose and legacy values stay text. */
export function isWebUrl(value:string):boolean {
  if(!/^https?:\/\//i.test(value)||/[\s\u0000-\u001f\u007f\\]/u.test(value))return false;
  try {const url=new URL(value);return !!url.hostname&&!url.username&&!url.password;}
  catch {return false;}
}
export function webLink(label:string,url:string):string {
  return isWebUrl(url)?`<a class="resume-web-link" href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(label)}</a>`:escape(label);
}
export function contactValue(contact:Contact):string {
  return contact.url?webLink(contact.value,contact.url):escape(contact.value);
}
export function itemLinks(links?:WebLink[]):string {
  return links?.length?`<div class="resume-item-links">${links.map(link=>webLink(link.label,link.url)).join('')}</div>`:'';
}
