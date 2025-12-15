export interface Turno{
    id:string;
    userId:string;
    date:string;
    startTime:string;
    endTime:string;
    hours:number;
    salary:number; //ganado
    tips:number;
    location?:string;
    notes?:string;
    status:TurnosStatus;
    breakTime?:number; //minutos
    createdAt:string;
    updatedAt:string;
    customHourlyRate?:number;
}

export type TurnosStatus='scheduled'|'in_progress'|'completed'|'cancelled';
