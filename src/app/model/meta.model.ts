export interface Meta{
id:string;
userId:string;
type:'total_ganado'|'horas_totales'|'turnos_totales'|'cantidad_propinas';
target:number;
current:number;
period:'weekly'|'monthly'|'yearly';
startDate:string;
endDate:string;
achieved:boolean;
}