import { Component } from '@angular/core';

@Component({
  selector: 'app-storage-unit',
  imports: [],
  templateUrl: './storage-unit.html',
  styleUrl: './storage-unit.scss',
})
export class StorageUnit {

  // Temporary storage unit data
  storageUnits: string[] = [
    'Arkivförteckning 2016 - 2023',
    'Arkivförteckning 2024 -',
    'Verksamhetssystem'
  ];

  // Tracks the selected storage unit
  selectedUnit: string | null = null;

  // Selects or deselects a storage unit
  selectUnit(unit: string): void {
    this.selectedUnit = this.selectedUnit === unit ? null : unit;
  }
}
