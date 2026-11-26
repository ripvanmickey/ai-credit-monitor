// Generated audit messages originate in English. Localize their parameters as well
// as their labels so future dates/counts do not need new dictionary entries.
export function translateAuditMessage(source:string,language:'zh'|'en'|'ja'):string|null {
 if(language==='en')return null;
 const zh=language==='zh';
 const status=(value:string)=>({ok:zh?'已检查':'確認済み',partial:zh?'部分可用':'一部利用可能',failed:zh?'检查失败':'確認失敗',current:zh?'已更新':'更新済み',lagging:zh?'来源滞后':'出典の更新遅延',unavailable:zh?'来源不可用':'出典を取得できず'} as Record<string,string>)[value]??value;
 const dtcc=source.match(/^DTCC checked for all (\d+) issuers through (\d{4}-\d{2}-\d{2}): (ok|partial|failed)\. (.*)$/s);
 if(dtcc){
  const [,count,date,state,detail]=dtcc;
  const files=detail.match(/^(\d+)\/(\d+) public files available\.$/);
  const prefix=zh?`已核验全部${count}家公司截至${date}的DTCC公开披露：${status(state)}。`:`全${count}社の${date}までのDTCC公開開示を確認：${status(state)}。`;
  return prefix+(files?(zh?`${files[1]}/${files[2]}份公开文件可用。`:`公開ファイル${files[1]}/${files[2]}件を取得。`):(zh?'来源返回错误：':'出典のエラー：')+detail);
 }
 const daily=source.match(/^Public CDS daily sources checked for (\d{4}-\d{2}-\d{2}); added (\d+) observations\. (.*?)\. Quote dates are retained when the provider lags or cannot be accessed\. Equity-close coverage is tracked separately\.(?: Company-wide news verification pending: (.*?)\.)?$/s);
 if(!daily)return null;
 const [,date,count,rows,pending]=daily;
 const entries=rows.split('; ').map(row=>{
  const match=row.match(/^([A-Z]+): (\d{4}-\d{2}-\d{2}|no quote) \((current|lagging|unavailable)\)$/);
  if(!match)return null;
  return `${match[1]}：${match[2]==='no quote'?(zh?'无可核验报价':'検証可能な相場なし'):match[2]}（${status(match[3])}）`;
 });
 if(entries.some(row=>row===null))return null;
 return (zh?`已检查${date}的公开CDS日线来源，新增${count}条观测。`:`${date}の公開CDS日足を確認し、${count}件の観測値を追加。`)+entries.join(zh?'；':'、')+(zh?'。来源滞后或无法访问时，保留原报价日期；股价收盘数据的更新状态单独追踪。':'。出典の更新遅延・取得不能時は元の相場日付を保持。株価終値の更新状況は別に管理。')+(pending?(zh?`以下公司的新闻核验尚待完成：${pending}。`:`以下の企業の報道確認は未完了：${pending}。`):'');
}
