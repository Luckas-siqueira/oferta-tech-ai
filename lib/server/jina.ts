import {allowedURL,boundedBody,extractionFailure,parsePrice,type Extracted} from './extraction';
const clean=(v:unknown,max=360)=>String(v||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
export function parseJina(payload:any,original:string):Extracted {
 const d=payload?.data;if(!d||typeof d.content!=='string')throw Error('O Jina não retornou conteúdo de produto.');
 const text=d.content;
 if(/Login Necessário|Faça login para continuar|Access Denied|captcha|verify you are human/i.test(text.slice(0,5000)))throw Error('A loja exigiu login ou bloqueou a leitura pelo Jina. Complete os dados manualmente.');
 let name=clean(d.title,180),description=clean(d.description),image_url='',price:number|null=null,previous_price:number|null=null;
 if(/^(Shopee Brasil|Mercado Livre Brasil|Access Denied|Login|Just a moment)/i.test(name))name='';
 if(/Visite a página e encontre todos os produtos|Melhores preços do mercado|Ofertas incríveis/i.test(description))description='';
 const metadata=d.metadata||{};
 const image=metadata['og:image']||metadata['twitter:image'];if(typeof image==='string'&&allowedURL(image,true))image_url=image;
 // An affiliate profile contains unrelated recommendations. Only inspect the featured card whose title matches the page title.
 const featured=text.split(/\n(?:##\s*)?(?:Quem viu este produto também comprou|Para você|Produtos recomendados)\b/i)[0];
 const images=[...featured.matchAll(/!\[([^\]]*)\]\((https:\/\/[^\s)]+)\)/g)];
 const match=images.find(m=>m[1].replace(/^Image\s+\d+:\s*/i,'').trim()===name);
 if(match&&allowedURL(match[2],true)){
  image_url=match[2];
  const block=featured.slice(match.index).slice(0,6000);
  const titledLink=[...block.matchAll(/(?<!!)\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g)].find(m=>clean(m[1],180)===name&&allowedURL(m[2]));
  if(titledLink){const detail=block.slice((titledLink.index||0)+titledLink[0].length).split(/\n\s*\[/)[0];
   const old=detail.match(/~~\s*R\$\s*([\d.,]+)\s*~~/);previous_price=old?parsePrice(old[1]):null;
   const withoutOld=detail.replace(/~~[\s\S]*?~~/g,'');const now=withoutOld.match(/(?:^|\n)\s*R\$\s*([\d.,]+)/);price=now?parsePrice(now[1]):null;
  }
 }
 if(!name&&!image_url)throw Error('O Jina leu a página, mas não identificou o produto principal. Complete os dados manualmente.');
 if(price!==null&&previous_price!==null&&previous_price<=price)previous_price=null;
 const partial=!name||!description||!image_url;
 return {name,description,image_url,price,previous_price,brand:'',category:/mouse|teclado|headset/i.test(name)?'Periféricos':'',specs:[],store:new URL(original).hostname==='meli.la'?'mercadolivre.com.br':new URL(original).hostname,partial,warning:(partial?extractionFailure+' ':'')+'Leitura pelo Jina Reader: revise os dados e confirme o preço e a variação no anúncio. A descrição e as especificações podem estar incompletas.',provider:'jina'} as Extracted;
}
export async function extractWithJina(url:string,fetcher:typeof fetch=fetch){if(!allowedURL(url))throw Error('Link fora da lista de lojas permitidas.');const response=await fetcher('https://r.jina.ai/'+url,{redirect:'manual',headers:{Accept:'application/json','X-With-Images-Summary':'true','X-Timeout':'25'},signal:AbortSignal.timeout(35000)});if(response.status>=300&&response.status<400){await response.body?.cancel();throw Error('O Jina retornou um redirecionamento inesperado.');}if(!response.ok){await response.body?.cancel();throw Error(response.status===429?'O limite gratuito do Jina foi atingido. Aguarde um minuto e tente novamente.':'O Jina não conseguiu ler o link. Preencha os dados manualmente.');}const data=JSON.parse(new TextDecoder().decode(await boundedBody(response,2000000)));return parseJina(data,url);}
