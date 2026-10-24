import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PublicArchivalSystem } from './public-archival-system';

describe('PublicArchivalSystem', () => {
  let component: PublicArchivalSystem;
  let fixture: ComponentFixture<PublicArchivalSystem>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PublicArchivalSystem],
    }).compileComponents();

    fixture = TestBed.createComponent(PublicArchivalSystem);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
