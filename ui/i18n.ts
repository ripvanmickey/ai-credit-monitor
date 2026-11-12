import translations from './translations.json';
import timingTranslations from './translations-timing.json';
import {messagePatterns} from './translation-patterns';
export type Language='zh'|'en'|'ja';
export const languagePreferenceKey='research-language';
const isLanguage=(value:string|null):value is Language=>value==='zh'||value==='en'||value==='ja';
function systemLanguage():Language{
 if(typeof navigator==='undefined')return 'zh';
 for(const locale of [...(navigator.languages??[]),navigator.language]){
  const primary=locale?.toLowerCase().split('-')[0];
  if(primary&&isLanguage(primary))return primary;
 }
 return 'zh';
}
let preferredLanguage:Language|null=null;
try{
 const saved=localStorage.getItem(languagePreferenceKey);
 if(isLanguage(saved))preferredLanguage=saved;
}catch{}
let language=preferredLanguage??systemLanguage();
const dictionary={...translations,...timingTranslations} as Record<string,{en:string;ja:string}>;
const originals=new WeakMap<Text,{source:string;last:string}>(),attributes=new WeakMap<Element,Map<string,{source:string;last:string}>>();
const sorted=Object.keys(dictionary).filter(k=>k.length>1).sort((a,b)=>b.length-a.length);
// React select labels must read the saved source, never a previously translated DOM value.
export function sourceText(node:Node):string{if(node.nodeType===3){const r=originals.get(node as Text);return r&&node.textContent===r.last?r.source:node.textContent||'';}return Array.from(node.childNodes).map(sourceText).join('');}
export function sourceAttribute(el:Element,key:string):string{const r=attributes.get(el)?.get(key),current=el.getAttribute(key)||'';return r&&current===r.last?r.source:current;}
export const getLanguage=()=>language;
export function translate(source:string,locale:Language=language){const language=locale;if(language==='zh'||!/[\u3400-\u9fff]/.test(source))return source;const summary=source.match(/^(\d+)家回款天数拉长，(\d+)家缩短，(\d+)家大致持平$/);if(summary)return language==='en'?`${summary[1]} increased, ${summary[2]} decreased, ${summary[3]} broadly flat`:`${summary[1]}社で回収日数増加、${summary[2]}社で短縮、${summary[3]}社は概ね横ばい`;const trim=source.trim(),exact=dictionary[trim];if(exact)return source.replace(trim,exact[language]);const core=trim.replace(/^[↗↓↑→←×\s]+|[↗↓↑→←×\s]+$/g,'');if(dictionary[core])return source.replace(core,dictionary[core][language]);const rendered:string[]=[];const protect=(value:string)=>{rendered.push(value);return '\uE000'+(rendered.length-1)+'\uE001';};let text=source.replace(/(\d+)家回款天数拉长，(\d+)家缩短，(\d+)家大致持平/g,language==='en'?'$1 increased, $2 decreased, $3 broadly flat':'$1社で回収日数増加、$2社で短縮、$3社は概ね横ばい');for(const [re,en,ja] of messagePatterns)text=text.replace(re,(...args)=>protect((language==='en'?en:ja).replace(/\$(\d+)/g,(_,i)=>args[Number(i)]??'')));for(const k of sorted)if(text.includes(k))text=text.split(k).join(protect(dictionary[k][language]));
 const patterns:[RegExp,string,string][]=[[/截至\s*/g,'As of ','基準日 '],[/披露／可用\s*/g,'Published / available ','公表・利用可能日 '],[/最近核验：/g,'Last verified: ','最終検証：'],[/最近资料检查：/g,'Last checked: ','最終確認：'],[/最近检查：/g,'Last checked: ','最終確認：'],[/财报核验截至/g,'Filings verified through ','決算検証基準日 '],[/最近四个已披露季度/g,'Last four reported quarters','直近4四半期'],[/项/g,' dimensions','項目'],[/最新：/g,'Latest: ','最新：'],[/序列起点/g,'Series start','系列の開始点'],[/发布\s*/g,'Published ','公表 '],[/(\d+)家回款天数拉长，(\d+)家缩短，(\d+)家大致持平/g,'$1 increased, $2 decreased, $3 broadly flat','$1社で回収日数増加、$2社で短縮、$3社は概ね横ばい'],[/(\d+(?:\.\d+)?)天/g,'$1 days','$1日'],[/(\d+(?:\.\d+)?)日/g,'$1 days','$1日'],[/亿美元/g,'USD 100m','億米ドル'],[/百万美元/g,'USD million','百万米ドル'],[/(\d+)家公司/g,'$1 companies','$1社'],[/(\d+)家公司/g,'$1 companies','$1社'],[/(\d+)\s*家/g,'$1 companies','$1社'],[/(\d+)个观测日/g,'$1 observations','$1観測日'],[/(\d+)个共同报价日/g,'$1 common quote dates','$1共通観測日'],[/近1月：样本不足/g,'Past month: insufficient history','直近1か月：履歴不足'],[/近1月/g,'Past month','直近1か月'],[/计算：/g,'Computed: ','計算日時：'],[/信用检查：/g,'Credit checked: ','信用確認：'],[/财报核验：/g,'Filings checked: ','決算検証：'],[/英伟达/g,'NVIDIA','NVIDIA'],[/迈威尔/g,'Marvell','Marvell'],[/英特尔/g,'Intel','Intel'],[/博通/g,'Broadcom','Broadcom'],[/回款天数/g,'receivables days','回収日数'],[/日K/g,'daily candles','日足'],[/尚未/g,'Not yet ','未'],[/待核验/g,'Unverified','未検証']];
 for(const [re,en,ja] of patterns)text=text.replace(re,(...args)=>protect((language==='en'?en:ja).replace(/\$(\d+)/g,(_,i)=>args[Number(i)]??'')));if(/[\u3400-\u9fff]/.test(text))return source;const result=text.replace(/\uE000(\d+)\uE001/g,(_,i)=>rendered[Number(i)]);return language==='en'?result.replace(/，/g,', ').replace(/；/g,'; ').replace(/：/g,': ').replace(/。/g,'.').replace(/（/g,' (').replace(/）/g,')').replace(/\b1 observations\b/g,'1 observation').replace(/Past 1 month\(s\)/g,'Past month'):result;}
let queued=false;let observer:MutationObserver;
function localize(){observer?.disconnect();const walk=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let n:Node|null;while(n=walk.nextNode()){const node=n as Text;if(node.parentElement?.closest('script,style,code,pre,[data-no-i18n]'))continue;let r=originals.get(node);if(!r||node.data!==r.last)r={source:node.data,last:node.data};const text=translate(r.source);if(node.data!==text)node.data=text;r.last=text;originals.set(node,r);}
 for(const el of document.querySelectorAll('[title],[aria-label],[placeholder]')){if(el.closest('[data-no-i18n]'))continue;let map=attributes.get(el);if(!map){map=new Map();attributes.set(el,map);}for(const key of ['title','aria-label','placeholder']){const cur=el.getAttribute(key);if(cur===null)continue;let r=map.get(key);if(!r||cur!==r.last)r={source:cur,last:cur};const text=translate(r.source);if(cur!==text)el.setAttribute(key,text);r.last=text;map.set(key,r);}}
 document.documentElement.lang=language==='zh'?'zh-CN':language;const titles:Record<string,string>={'/':'CDS 与信用利差监测','/cycle/':'AI 建设见顶信号','/sox/':'半导体指数回测'};const title=/\/sox\/timing(?:-panel)?\.html$/.test(location.pathname)?'量化抄底策略':titles[location.pathname];if(title)document.title=translate(title);observer?.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['title','aria-label','placeholder']});queued=false;}
export function refreshLanguage(){
 const next=preferredLanguage??systemLanguage();
 if(language===next)return;
 language=next;
 localize();
 document.dispatchEvent(new Event('research-language-change'));
}
export function syncLanguagePreference(value:string|null){
 preferredLanguage=isLanguage(value)?value:null;
 refreshLanguage();
}
export function setLanguage(value:Language){
 try{localStorage.setItem(languagePreferenceKey,value);}catch{}
 syncLanguagePreference(value);
}
export function startLocalization(){observer=new MutationObserver(()=>{if(!queued){queued=true;queueMicrotask(localize);}});localize();}
