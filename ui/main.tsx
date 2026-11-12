import {getLanguage,languagePreferenceKey,refreshLanguage,setLanguage,startLocalization,sourceText,sourceAttribute,syncLanguagePreference,translate,type Language} from './i18n';
import * as React from 'react';
import {createRoot} from 'react-dom/client';
import {Button} from './components/button';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from './components/select';
import {isResearchPage,linkDestination,modulePath,panelURL,researchPath,startPanelNavigation} from './navigation';
import {startComponentPolish} from './polish';
import {Activity,ChartNoAxesCombined,Layers,PanelLeft,Languages,TrendingUp} from 'lucide-react';
function pageTitle(path:string){
 if(path==='/sox/timing.html')return '量化抄底策略';
 return path.startsWith('/sox')?'半导体指数回测':path.startsWith('/cycle')?'AI 建设见顶信号':'CDS 与信用利差监测';
}
function subscribeLanguage(update:()=>void){
 document.addEventListener('research-language-change',update);
 return()=>document.removeEventListener('research-language-change',update);
}
function Shell({path,closeMobile,locale}:{path:string;closeMobile:React.MutableRefObject<()=>void>;locale:Language}){
 const [open,setOpen]=React.useState(()=>innerWidth>760);
 const sidebarToggle=React.useRef<HTMLButtonElement>(null);
 const mobileToggle=React.useRef<HTMLButtonElement>(null);
 const moveFocus=React.useRef(false);
 const mobile=()=>matchMedia('(max-width:760px)').matches;
 const toggleMenu=()=>{
  moveFocus.current=mobile();
  setOpen(value=>!value);
 };
 closeMobile.current=()=>{
  if(mobile())setOpen(false);
 };
 React.useLayoutEffect(()=>{
  document.body.classList.toggle('sidebar-expanded',open);
  document.body.classList.add('has-sidebar');
  if(moveFocus.current){
   (open?sidebarToggle:mobileToggle).current?.focus();
   moveFocus.current=false;
  }
  return()=>document.body.classList.remove('sidebar-expanded','has-sidebar');
 },[open]);
 const linkGroups=[
  [
   {name:'CDS 与信用利差监测',url:'/',icon:Activity,active:!path.startsWith('/sox')&&!path.startsWith('/cycle')},
   {name:'AI 建设见顶信号',url:'/cycle/',icon:Layers,active:path.startsWith('/cycle')},
  ],
  [
   {name:'半导体指数回测',url:'/sox/',icon:ChartNoAxesCombined,active:path.startsWith('/sox')&&path!=='/sox/timing.html'},
   {name:'量化抄底策略',url:'/sox/timing.html',icon:TrendingUp,active:path==='/sox/timing.html'},
  ],
 ];
 const toggleLabel=open?'收起左侧菜单':'展开左侧菜单';
 return <>
  <aside id="research-sidebar" className={'ui-sidebar '+(open?'is-open':'')} aria-label="研究目录">
   <div className="ui-sidebar-header">
    <a className="ui-brand" href={researchPath('/')} title="半导体与算力信用">
     <img className="ui-logo" src={researchPath('/cycle/project-icon.svg')} width={36} height={36} alt="" />
     {open&&<span>半导体与算力信用<small>MARKET RESEARCH</small></span>}
    </a>
    <Button ref={sidebarToggle} variant="ghost" size="icon" className="ui-sidebar-toggle"
     title={toggleLabel} aria-label={toggleLabel} aria-controls="research-sidebar" aria-expanded={open} onClick={toggleMenu}>
     <PanelLeft size={18}/>
    </Button>
   </div>
   <nav className="ui-sidebar-modules" style={{gap:16}} aria-label="研究模块">
    {linkGroups.map(links=><div className="ui-sidebar-modules" key={links[0].url}>
     {links.map(link=><a key={link.url} href={researchPath(link.url)} className="ui-sidebar-module"
      aria-label={link.name} aria-current={link.active?'page':undefined} title={open?undefined:link.name}>
      <span className="ui-sidebar-module-media"><link.icon size={17} aria-hidden="true"/></span>
      {open&&<span className="ui-sidebar-module-title">{link.name}</span>}
     </a>)}
    </div>)}
   </nav>
   <div className="ui-sidebar-foot">
    {open?<><span>公开来源 · 保留原始口径</span>{locale!=='zh'&&<small style={{whiteSpace:'normal',marginTop:8}}>指标名称沿用原始披露口径，分析说明随语言切换。</small>}</>:'研究'}
   </div>
  </aside>
  {open&&<button className="ui-sidebar-backdrop" aria-label="关闭目录" onClick={toggleMenu}/>}
  <div className="ui-pagebar">
   {!open&&<Button ref={mobileToggle} variant="ghost" size="icon" className="ui-mobile-menu-toggle"
    aria-label="展开左侧菜单" aria-controls="research-sidebar" aria-expanded={false} onClick={toggleMenu}>
    <PanelLeft size={18}/>
   </Button>}
   <span className="ui-page-title" data-no-i18n>{translate(pageTitle(path),locale)}</span>
   <div className="ui-language" data-no-i18n>
    <Select value={locale} onValueChange={value=>setLanguage(value as Language)}>
     <SelectTrigger aria-label="Language / 言語 / 语言" className="ui-select-trigger">
      <Languages size={16} aria-hidden="true"/><SelectValue/>
     </SelectTrigger>
     <SelectContent className="ui-select-content" data-no-i18n>
      <SelectItem value="zh">中文</SelectItem><SelectItem value="en">English</SelectItem><SelectItem value="ja">日本語</SelectItem>
     </SelectContent>
    </Select>
   </div>
  </div>
 </>;
}
function SectionNav({path,locale}:{path:string;locale:Language}){
 if(path.startsWith('/sox'))return null;
 const links=path.startsWith('/cycle')
  ?[['四项核心信号','#cards'],['算力租价','#gpu-rents'],['云厂商信用','#cloud-credit'],['订单兑现','#order-demand'],['回款质量','#chip-dso'],['查看规则与阈值','#rules']]
  :[['走势分析','#analysis'],['信用利差趋势','#trends'],['监测名单','#watchlist'],['风险动态','#events'],['数据口径','#method']];
 return <nav className="research-section-nav" data-no-i18n aria-label={translate('页面导航',locale)}>
  {links.map(([label,url])=><a key={url} href={url}>{translate(label,locale)}</a>)}
 </nav>;
}

function scrollPanel(frame: HTMLIFrameElement | null, hash: string) {
 const child=frame?.contentWindow;
 if(!child)return;
 let id=hash.slice(1);
 try{id=decodeURIComponent(id);}catch{}
 if(id)child.document.getElementById(id)?.scrollIntoView();
 else child.scrollTo(0,0);
}

function ResearchApp(){
 const locale=React.useSyncExternalStore(subscribeLanguage,getLanguage);
 const [route,setRoute]=React.useState(()=>new URL(location.href));
 const frame=React.useRef<HTMLIFrameElement>(null);
 const ready=React.useRef(false);
 const closeMobile=React.useRef(()=>{});
 const path=modulePath(route.pathname);
 const page=path+route.search;
 const src=panelURL(path,route.search);

 React.useEffect(()=>{
  function navigate(url:URL){
   if(url.href!==location.href){
    history.pushState(null,'',url);
    setRoute(url);
   }else scrollPanel(frame.current,url.hash);
   closeMobile.current();
  }
  function onClick(event:MouseEvent){
   const url=linkDestination(event,location.href);
   if(!url)return;
   event.preventDefault();
   navigate(url);
  }
  function onMessage(event:MessageEvent){
   if(event.origin!==location.origin||event.source!==frame.current?.contentWindow||event.data?.type!=='research-navigation')return;
   if(typeof event.data.url!=='string')return;
   let url:URL;
   try{url=new URL(event.data.url);}catch{return;}
   if(url.origin===location.origin&&isResearchPage(url.pathname))navigate(url);
  }
  function onPop(){setRoute(new URL(location.href));}
  document.addEventListener('click',onClick);
  window.addEventListener('message',onMessage);
  window.addEventListener('popstate',onPop);
  return ()=>{
   document.removeEventListener('click',onClick);
   window.removeEventListener('message',onMessage);
   window.removeEventListener('popstate',onPop);
  };
 },[]);
 React.useLayoutEffect(()=>{ready.current=false;},[page]);
 React.useEffect(()=>{if(ready.current)scrollPanel(frame.current,route.hash);},[page,route.hash]);
 React.useEffect(()=>{document.title=translate(pageTitle(path),locale);},[path,locale]);
 return <>
  <Shell path={path} closeMobile={closeMobile} locale={locale}/>
  <SectionNav path={path} locale={locale}/>
  <iframe key={page} ref={frame} className="research-panel-frame" src={src.pathname+src.search}
   title={translate(pageTitle(path),locale)}
   onLoad={()=>{ready.current=true;scrollPanel(frame.current,route.hash);}}/>
 </>;
}

const shell=document.querySelector('#research-ui');
if(shell){
 createRoot(shell).render(<ResearchApp/>);
}else{
 startPanelNavigation();
}
window.addEventListener('languagechange',refreshLanguage);
window.addEventListener('storage',event=>{
 if(event.storageArea===localStorage&&(event.key===languagePreferenceKey||event.key===null)){
  syncLanguagePreference(event.newValue);
 }
});
function StyledSelect({native}:{native:HTMLSelectElement}){
 const [,tick]=React.useReducer(n=>n+1,0);
 React.useEffect(()=>{
  const observer=new MutationObserver(()=>tick());observer.observe(native,{childList:true,subtree:true,attributes:true,characterData:true});
  native.addEventListener('change',tick);document.addEventListener('research-language-change',tick);
  const descriptor=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value');
  if(descriptor?.get&&descriptor?.set)Object.defineProperty(native,'value',{configurable:true,get(){return descriptor.get!.call(native)},set(v){descriptor.set!.call(native,v);tick();}});
  return()=>{observer.disconnect();native.removeEventListener('change',tick);document.removeEventListener('research-language-change',tick);delete (native as any).value;};
 },[native]);
 const options=Array.from(native.options),value=native.value||'__empty__';
 const label=native.labels?.[0];
 const name=sourceAttribute(native,'aria-label')||(label?Array.from(label.childNodes).filter(n=>n.nodeType===3).map(sourceText).join('').trim():'')||'选择选项';
 const selected=options.find(o=>(o.value||'__empty__')===value);
 return <Select value={value} disabled={native.disabled||!options.length} onValueChange={v=>{native.value=v==='__empty__'?'':v;native.dispatchEvent(new Event('change',{bubbles:true}));tick();}}>
  <SelectTrigger aria-label={translate(name)} className="ui-select-trigger"><SelectValue placeholder={translate('请选择')}>{selected?translate(sourceText(selected)):translate('请选择')}</SelectValue></SelectTrigger>
  <SelectContent className="ui-select-content" position="popper" data-no-i18n>{options.map((o,i)=><SelectItem key={o.value+'-'+i} value={o.value||'__empty__'} disabled={o.disabled}>{translate(sourceText(o))}</SelectItem>)}</SelectContent>
 </Select>
}
function mountSelects(){document.querySelectorAll<HTMLSelectElement>('select:not([data-ui-select])').forEach(native=>{if(native.multiple)return;Array.from(native.options).forEach(o=>{if(!o.hasAttribute('value'))o.setAttribute('value',o.value);});native.dataset.uiSelect='true';native.style.display='none';const host=document.createElement('span');host.className='ui-select-host';host.setAttribute('data-no-i18n','');native.insertAdjacentElement('afterend',host);createRoot(host).render(<StyledSelect native={native}/>);});}
if(!shell){
 mountSelects();
 new MutationObserver(m=>{if(m.some(r=>Array.from(r.addedNodes).some(n=>n instanceof Element&&(n.tagName==='SELECT'||n.querySelector('select:not([data-ui-select])')))))mountSelects();}).observe(document.body,{subtree:true,childList:true});
}

startLocalization();
if(!shell){
 startComponentPolish();
 if(document.querySelector('[data-research-table]')){
  void import('./data-table').then(({startDataTables})=>startDataTables());
 }
 if(document.querySelector('#analysis, #gpu-history, #bars')){
  void import('./research-charts').then(({startResearchCharts})=>startResearchCharts()).catch(error=>{
   console.warn('Interactive charts could not load.',error);
  });
 }
}
