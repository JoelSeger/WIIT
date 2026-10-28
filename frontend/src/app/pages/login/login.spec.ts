import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LoginComponent } from './login';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show email and password fields', () => {
    const element: HTMLElement = fixture.nativeElement;

    expect(element.querySelector('#email')).toBeTruthy();
    expect(element.querySelector('#password')).toBeTruthy();
  });

  it('should disable login when the form is empty', () => {
    const element: HTMLElement = fixture.nativeElement;
    const button = element.querySelector(
      'button[type="submit"]' 
    ) as HTMLButtonElement;

    expect(button.disabled).toBeTruthy();
  });

  it('should show a placeholder message on submit', () => {
    component.onSubmit();

    expect(component.loginError).toBe(
      'Inloggning är inte tillgänglig ännu.'
    );
  });
});