import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PublicArchivalSystem } from './public-archival-system';

describe('PublicArchivalSystem', () => {
  let component: PublicArchivalSystem;
  let fixture: ComponentFixture<PublicArchivalSystem>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PublicArchivalSystem],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(PublicArchivalSystem);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
