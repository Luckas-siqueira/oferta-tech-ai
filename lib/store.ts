import {emptyOffer,type OfferInput} from './shared/offer';
export const storeURL='https://luckas-siqueira.github.io/Mega-Vitrine/';
export const storeCategories=['Teclados e Mouses','Áudio e Headsets','Processadores','Placas de Vídeo','Memória RAM','SSD e HD','Computadores e Notebooks','Placas-Mãe','Fontes','Gabinetes','Refrigeração','Monitores','Redes e Conectividade','Kits e Acessórios para PC','Games e Consoles'];
export type StoreProduct={id:string;nome:string;descricao:string;categoria:string;imagem:string;preco:number|null;precoAnterior:number|null;destaque:boolean;url:string};
const repo='https://api.github.com/repos/Luckas-siqueira/Mega-Vitrine';
export const encodeText=(s:string)=>{const bytes=new TextEncoder().encode(s);let binary='';for(const b of bytes)binary+=String.fromCharCode(b);return btoa(binary)};
const decodeText=(s:string)=>new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\s/g,'')),c=>c.charCodeAt(0)));
export function parseCatalog(s:string):StoreProduct[]{const arr=JSON.parse(s);if(!Array.isArray(arr)||arr.some(p=>!p||typeof p.id!=='string'||typeof p.nome!=='string'||typeof p.categoria!=='string'))throw Error('O catálogo da loja está inválido. Nenhuma alteração foi feita.');return arr;}
export function storeDraft(p:StoreProduct):OfferInput{return {...emptyOffer(),name:p.nome,description:p.descricao,category:'Informática',affiliate_url:p.url,image_url:new URL(p.imagem,storeURL).href,price:p.preco,previous_price:p.precoAnterior};}
export function suggestedCategory(o:OfferInput){const map:Record<string,string>={'Placas de vídeo':'Placas de Vídeo','SSDs e HDs':'SSD e HD','Computadores':'Computadores e Notebooks','Placas-mãe':'Placas-Mãe','Periféricos':'Teclados e Mouses'};return storeCategories.includes(o.category)?o.category:map[o.category]||'Kits e Acessórios para PC';}
export async function githubStore(token:string,path:string,method='GET',data?:unknown):Promise<any>{if(!token.trim()||! /^[A-Za-z0-9_.-]+$/.test(token.trim()))throw Error('Conecte a loja com um token válido do GitHub, em Minha loja.');const res=await fetch(repo+path,{method,cache:'no-store',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(30000),headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+token.trim(),'X-GitHub-Api-Version':'2022-11-28',...(data?{'Content-Type':'application/json'}:{})},...(data?{body:JSON.stringify(data)}:{})});if(!res.ok)throw Error(res.status===401?'Token inválido ou expirado.':res.status===403?'O GitHub recusou o acesso. Confira Contents: Read and write para Mega-Vitrine.':[409,422].includes(res.status)?'O catálogo mudou durante a operação. Atualize e tente novamente; nenhuma alteração foi sobrescrita.':'Falha ao acessar o GitHub ('+res.status+').');return res.json();}
export async function readCatalog(token:string){const d=await githubStore(token,'/contents/produtos.json?ref=main');return parseCatalog(decodeText(d.content));}
export function mergeProduct(catalog:StoreProduct[],product:StoreProduct|null,old?:StoreProduct){if(old){const i=catalog.findIndex(p=>p.id===old.id);if(i<0||JSON.stringify(catalog[i])!==JSON.stringify(old))throw Error('Este produto foi alterado. Recarregue a loja antes de editar ou excluir.');return product?catalog.map((p,n)=>n===i?product:p):catalog.filter(p=>p.id!==old.id);}if(!product)throw Error('Selecione o produto a excluir.');if(catalog.some(p=>p.id===product.id||p.url===product.url))throw Error('Este link já está na loja. Edite o produto existente.');return [...catalog,product];}
export async function writeProduct(token:string,product:StoreProduct|null,old?:StoreProduct,photo?:Blob){
 const ref=await githubStore(token,'/git/ref/heads/main');const base=ref.object.sha;
 const commit=await githubStore(token,'/git/commits/'+base);
 const data=await githubStore(token,'/contents/produtos.json?ref='+base);
 let updated=product?{...product}:null;const tree:any[]=[];
 // Check conflicts before uploading even orphaned Git blobs.
 mergeProduct(parseCatalog(decodeText(data.content)),updated,old);
 if(photo&&updated){if(!['image/jpeg','image/png','image/webp'].includes(photo.type)||photo.size>5000000||!photo.size)throw Error('Foto inválida. Use JPG, PNG ou WebP até 5 MB.');const bytes=new Uint8Array(await photo.arrayBuffer());let b='';for(const v of bytes)b+=String.fromCharCode(v);const blob=await githubStore(token,'/git/blobs','POST',{content:btoa(b),encoding:'base64'});const path='imagens/produtos/tech-'+crypto.randomUUID()+'.'+(photo.type==='image/png'?'png':photo.type==='image/webp'?'webp':'jpg');updated.imagem=path;tree.push({path,mode:'100644',type:'blob',sha:blob.sha});}
 const catalog=mergeProduct(parseCatalog(decodeText(data.content)),updated,old);
 const json=await githubStore(token,'/git/blobs','POST',{content:encodeText(JSON.stringify(catalog,null,2)+'\n'),encoding:'base64'});tree.push({path:'produtos.json',mode:'100644',type:'blob',sha:json.sha});
 const t=await githubStore(token,'/git/trees','POST',{base_tree:commit.tree.sha,tree});
 const c=await githubStore(token,'/git/commits','POST',{message:(updated?'Publicar produto: '+updated.nome:'Excluir produto: '+old?.nome)+' — Oferta Tech AI',tree:t.sha,parents:[base]});
 await githubStore(token,'/git/refs/heads/main','PATCH',{sha:c.sha,force:false});
 return catalog;
}
