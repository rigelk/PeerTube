import { Component, Input, OnInit } from '@angular/core'
import { Notifier, ServerService } from '@app/core'
import { ServerConfig, UserUpdateMe } from '../../../../../../shared'
import { AuthService } from '../../../core'
import { FormReactive } from '../../../shared/forms/form-reactive'
import { User, UserService } from '../../../shared/users'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { FormValidatorService } from '@app/shared/forms/form-validators/form-validator.service'
import { Subject } from 'rxjs'

@Component({
  selector: 'my-account-interface-settings',
  templateUrl: './my-account-interface-settings.component.html',
  styleUrls: [ './my-account-interface-settings.component.scss' ]
})
export class MyAccountInterfaceSettingsComponent extends FormReactive implements OnInit {
  @Input() user: User = null
  @Input() reactive = false
  @Input() notify = true
  @Input() userInformationLoaded: Subject<any>

  private serverConfig: ServerConfig

  constructor (
    protected formValidatorService: FormValidatorService,
    private authService: AuthService,
    private notifier: Notifier,
    private userService: UserService,
    private serverService: ServerService,
    private i18n: I18n
  ) {
    super()
  }

  get availableThemes () {
    return this.serverConfig.theme.registered
               .map(t => t.name)
  }

  ngOnInit () {
    this.serverConfig = this.serverService.getTmpConfig()
    this.serverService.getConfig()
        .subscribe(config => this.serverConfig = config)

    this.buildForm({
      theme: null
    })

    this.userInformationLoaded
      .subscribe(() => {
        this.form.patchValue({
          theme: this.user.theme
        })

        if (this.reactive) {
          this.form.valueChanges.subscribe(val => {
            if (!this.authService.isLoggedIn()) this.updateInterfaceSettings()
          })
        }
      })
  }

  updateInterfaceSettings () {
    const theme = this.form.value['theme']

    const details: UserUpdateMe = {
      theme
    }

    if (this.authService.isLoggedIn()) {
      this.userService.updateMyProfile(details).subscribe(
        () => {
          this.authService.refreshUserInformation()

          if (this.notify) this.notifier.success(this.i18n('Interface settings updated.'))
        },

        err => this.notifier.error(err.message)
      )
    } else {
      this.userService.updateMyAnonymousProfile(details)
      if (this.notify) this.notifier.success(this.i18n('Interface settings updated.'))
    }
  }
}
