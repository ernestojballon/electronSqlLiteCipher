import { Component, OnInit } from '@angular/core';
import { ElectronService  } from 'ngx-electron';


@Component({
  selector: 'app-welcome',
  templateUrl: './welcome.component.html',
  styleUrls: ['./welcome.component.scss'],
})
export class WelcomeComponent implements OnInit {
  isElectronApp: boolean = this.electronService.isElectronApp;
  file: string;
  constructor(
    private electronService: ElectronService
  ) {
    if (this.isElectronApp) {
      console.log('I AM ELECTRON');
      this.electronService.ipcRenderer.on('trigger-alert', (event, message)=>{
        console.log('catching trigger: ',message);
      });
    }
  }

  ngOnInit(  ) {

  }

  connectDatabase(){
    if (this.isElectronApp) {
      console.log('I AM ELECTRON');
      this.electronService.ipcRenderer.send('opendatabase');
    }
  }

  changeListener($event): void {

    this.file = $event.target.files[0];
    console.log(this.file);
  }

}
