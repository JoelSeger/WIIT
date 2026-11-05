import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StorageUnit } from './storage-unit';

describe('StorageUnit', () => {
  let component: StorageUnit;
  let fixture: ComponentFixture<StorageUnit>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StorageUnit],
    }).compileComponents();

    fixture = TestBed.createComponent(StorageUnit);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
