import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router'; 
import { Header } from '../header/header';
import { Nav } from '../nav/nav';
import { Menu } from '../menu/menu';
import { TreeView } from '../tree-view/tree-view';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [
    RouterOutlet,
    Header,
    Nav,
    Menu,
    TreeView
  ],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.scss'
})
export class MainLayoutComponent {

}