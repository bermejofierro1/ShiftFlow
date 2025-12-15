import { Injectable } from '@angular/core';
import { initializeApp,FirebaseApp } from 'firebase/app';
import { environment } from 'src/environments/environment';
import {getAuth}from 'firebase/auth';
import {getFirestore,Firestore} from 'firebase/firestore';
import { getStorage,FirebaseStorage } from 'firebase/storage';
import { Auth } from 'firebase/auth';
@Injectable({
  providedIn: 'root',
})
export class FirebaseService {

  public app:FirebaseApp;
  public auth:Auth;
  public firestore:Firestore;
public storage:FirebaseStorage;

constructor(){
  this.app=initializeApp(environment.firebaseConfig);
  this.auth=getAuth(this.app);
  this.firestore=getFirestore(this.app);
  this.storage=getStorage(this.app);
  console.log('Firebase inicializado correctamente');
}
  
}
