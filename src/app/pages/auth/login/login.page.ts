import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';

/**
 * página de login
 * Gestiona:
 * - validación de credenciales mediante formulario reactivo
 * - autenticación del usuario a través del AuthService
 * - manejo de estados de carga y mensajes de errores
 * - redirección tras inicio de sesión exitoso
 */
@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  standalone: false,
  styleUrls: ['./login.page.scss'],
})
export class LoginPage implements OnInit {

  loginForm!: FormGroup;
  errorMessage: string | null = null;
  loading = false;

  /**
   * 
   * @param fb para la gestión del formulario
   * @param authService servicio para la lógica de autenticación
   * @param router para la navegación tras el login
   */
  constructor(private fb: FormBuilder, private authService: AuthService, private router: Router) { }

  ngOnInit() {

    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  /**
   * Maneja el envío del formulario de login.
   * - valida el formulario antes de enviarlo
   * - llama al servicio de autenticación
   * - controla estados de carga y errores.
   * - redirige al usuario tras iniciar sesión correctamente
   */
  async onSubmit() {
    console.log('submit clicked');
    if (this.loginForm.invalid) return;

    this.loading = true;
    this.errorMessage = null;

    const { email, password } = this.loginForm.value;
    console.log(this.loginForm.value);

    try {
      await this.authService.login(email, password);
      console.log('login iniciado');
      this.router.navigate(['/tabs/home']);
    } catch (error: any) {
      console.error(error);
      this.errorMessage = this.getFirebaseErrorMessage(error);

    } finally {
      this.loading = false;
    }
  }

  /**
   * traduce los códigos de errores de Firebase Auth a mensajes para el usuario.
   * 
   * @param error Erorr devuelto por Firebase Auth 
   * @returns Mensaje de error para mostrar al usuario
   */
  private getFirebaseErrorMessage(error: any): string {
    const errorCode = error.code;

    switch (errorCode) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
        return 'La contraseña introducida no es correcta. Por favor, inténtalo de nuevo.';

      case 'auth/invalid-email':
        return 'El formato del correo no es correcto.'

      case 'auth/user-not-found':
        return 'No existe una cuetna con este email. Regístrate para crear una cuenta'


      //Errores de cuenta
      case 'auth/user-disable':
        return 'Esta cuenta ha sido deshabilitado. Contacte con soporte.'

      case 'auth/account-exists-with-different-credential':
        return 'Ya existe una cuenta con este email usando otro método de autenticación.';

      // Errores de límites y seguridad
      case 'auth/too-many-requests':
        return 'Demasiados intentos fallidos. Por seguridad, la cuenta ha sido temporalmente bloqueada. Inténtalo de nuevo más tarde.';

      case 'auth/operation-not-allowed':
        return 'El método de autenticación no está habilitado. Contacta con soporte.';

      // Red y servidor
      case 'auth/network-request-failed':
        return 'Error de conexión. Verifica tu conexión a internet e inténtalo de nuevo.';

      case 'auth/internal-error':
        return 'Error interno del servidor. Por favor, inténtalo de nuevo en unos minutos.';


      case 'auth/invalid-verification-code':
      case 'auth/invalid-verification-id':
        return 'Código de verificación inválido. Inténtalo de nuevo.';

      default:
        // Error genérico
        console.warn('Código de error no manejado:', errorCode);
        return 'Error al iniciar sesión. Por favor, verifica tus credenciales e inténtalo de nuevo.';
    }
  }

}
