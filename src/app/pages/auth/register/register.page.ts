import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';

/**
 * Página de registro para nuevos usuarios.
 * Permite crear una nueva cuenta mediante formularios,
 * validar los datos introducidos antes del envío,,
 * registrar al usuario a través del AuthService,
 * y manejar errores de registro.
 * redirigir al login tras un registro exitoso.
 */
@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  standalone: false,
  styleUrls: ['./register.page.scss'],
})
export class RegisterPage implements OnInit {

  //formulario de registro
  registerForm!: FormGroup;
  errorMessage: string | null = null;
  loading = false;

  constructor(private fb: FormBuilder, private authService: AuthService, private router: Router) { }

  ngOnInit() {

    this.registerForm = this.fb.group({
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      role: ['Camarero', Validators.required],
      hourlyRate: [10, [Validators.required, Validators.min(1)]]
    });
  }

  /**
   * Maneja el envío del formulario de registro.
   * valida el formulario antes de continuar,
   * llama al servicio de autenticacion para registrar al usuario,
   * controla estados de carga y errores,
   * redirige al login tras un registro exitoso.
   */
  async onSubmit() {
    if (this.registerForm.invalid) return;

    this.loading = true;
    this.errorMessage = null;


    const { name, email, password, role, hourlyRate } = this.registerForm.value;

    try {
      await this.authService.register(name, email, password, role, hourlyRate);
      this.router.navigate(['/login']);
    } catch (error: any) {
      console.error(error);
      this.errorMessage = error.message || 'Error al registrar al usuario';
    } finally {
      this.loading = false;
    }
  }

}
