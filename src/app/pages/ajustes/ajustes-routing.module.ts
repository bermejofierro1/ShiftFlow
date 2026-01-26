import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AjustesPage } from './ajustes.page';

const routes: Routes = [
  {
    path: '',
    component: AjustesPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AjustesPageRoutingModule {}
