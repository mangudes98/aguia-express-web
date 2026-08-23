// ARQUIVO: src/services/financeiro.ts
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Repasse, Usuario, Empresa } from "../types";

const num=(v:any)=>Number(v)||0;
export async function listarRepasses():Promise<Repasse[]>{
 const s=await getDocs(query(collection(db,"repasses"),orderBy("dataFim","desc")));
 return s.docs.map(d=>{const x:any=d.data();return {id:d.id,usuarioId:String(x.usuarioId??""),usuarioNome:String(x.usuarioNome??""),dataInicio:x.dataInicio,dataFim:x.dataFim,dataPagamento:x.dataPagamento,pago:!!x.pago,creditos:num(x.creditos),debitos:num(x.debitos),mlTotal:num(x.mlTotal),shopeeTotal:num(x.shopeeTotal),avulsoTotal:num(x.avulsoTotal),totalPacotes:num(x.totalPacotes),totalGeral:num(x.totalGeral),quinzena:x.quinzena,quinzenaLabel:x.quinzenaLabel,porTransportadora:Array.isArray(x.porTransportadora)?x.porTransportadora.map((z:any)=>({id:z.id,nome:String(z.nome??""),qtdML:num(z.qtdML),qtdShopee:num(z.qtdShopee),qtdAvulso:num(z.qtdAvulso),quantidade:num(z.quantidade),valor:num(z.valor)})):[],dadosBancarios:x.dadosBancarios};});
}
export async function listarUsuarios():Promise<Usuario[]>{
 const s=await getDocs(collection(db,"usuarios")); return s.docs.map(d=>{const x:any=d.data();return {id:d.id,email:String(x.email??d.id),nome:String(x.nome??""),tipo:x.tipo,banco:x.banco,pix:x.pix,favorecido:x.favorecido,ganhos:num(x.ganhos),permissoes:x.permissoes};});
}
export async function listarEmpresasPremium():Promise<Empresa[]>{
 const s=await getDocs(collection(db,"empresa")); return s.docs.map(d=>{const x:any=d.data();return {id:d.id,nome:String(x.nome??""),pastas:Array.isArray(x.pastas)?x.pastas.map(String):[],ativo:!!x.ativo,valorML:num(x.valorML),valorShopee:num(x.valorShopee),valorAvulso:num(x.valorAvulso)};});
}
export const nomePorEmail=(email:string, usuarios:Usuario[])=>usuarios.find(u=>u.email===email)?.nome?.trim()||email;
