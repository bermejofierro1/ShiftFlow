import { UserSettings } from "./userSettings.model";

export interface User{
    id:string;
    name:string;
    email:string;
    phone?:string;
    location?:string;
    role:string;
    hourlyRate:number;
    startDate:string;
    avatar?:string;
    settings?:UserSettings;
    createdAt:string;
    updatedAt:string;
}

