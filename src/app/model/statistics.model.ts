export interface Statistics{
    userId:string;
    period:'daily'|'weekly'|'monthly'|'yearly';
    totalTurnos:number;
    totalHoras:number;
    totalSalario:number;
    totalTips:number;
    totalGanado:number;
    averageHoursPerShift:number;
    averageEarningPerShift:number;
    tipsToSalaryRatio:number;
    bestShifts?:{id:string;date:string;earnings:number};
    worstShifts?:{id:string;date:string;earnings:number}
}