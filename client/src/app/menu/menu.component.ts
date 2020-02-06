import { Component, OnInit, ViewChild } from '@angular/core'
import { UserRight } from '../../../../shared/models/users/user-right.enum'
import { AuthService, AuthStatus, RedirectService, ServerService } from '../core'
import { User } from '../shared/users/user.model'
import { LanguageChooserComponent } from '@app/menu/language-chooser.component'
import { HotkeysService } from 'angular2-hotkeys'
import { ServerConfig, I18N_LOCALES } from '@shared/models'
import { QuickSettingsModalComponent } from '@app/modal/quick-settings-modal.component'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { startsWith, pickBy } from 'lodash-es'

@Component({
  selector: 'my-menu',
  templateUrl: './menu.component.html',
  styleUrls: [ './menu.component.scss' ]
})
export class MenuComponent implements OnInit {
  @ViewChild('languageChooserModal', { static: true }) languageChooserModal: LanguageChooserComponent
  @ViewChild('quickSettingsModal', { static: true }) quickSettingsModal: QuickSettingsModalComponent

  user: User
  isLoggedIn: boolean
  userHasAdminAccess = false
  helpVisible = false

  private serverConfig: ServerConfig
  private routesPerRight: { [ role in UserRight ]?: string } = {
    [UserRight.MANAGE_USERS]: '/admin/users',
    [UserRight.MANAGE_SERVER_FOLLOW]: '/admin/friends',
    [UserRight.MANAGE_VIDEO_ABUSES]: '/admin/moderation/video-abuses',
    [UserRight.MANAGE_VIDEO_BLACKLIST]: '/admin/moderation/video-blacklist',
    [UserRight.MANAGE_JOBS]: '/admin/jobs',
    [UserRight.MANAGE_CONFIGURATION]: '/admin/config'
  }

  constructor (
    private authService: AuthService,
    private serverService: ServerService,
    private redirectService: RedirectService,
    private hotkeysService: HotkeysService,
    private i18n: I18n
  ) {}

  ngOnInit () {
    this.serverConfig = this.serverService.getTmpConfig()
    this.serverService.getConfig()
      .subscribe(config => this.serverConfig = config)

    this.isLoggedIn = this.authService.isLoggedIn()
    if (this.isLoggedIn === true) this.user = this.authService.getUser()
    this.computeIsUserHasAdminAccess()

    this.authService.loginChangedSource.subscribe(
      status => {
        if (status === AuthStatus.LoggedIn) {
          this.isLoggedIn = true
          this.user = this.authService.getUser()
          this.computeIsUserHasAdminAccess()
          console.log('Logged in.')
        } else if (status === AuthStatus.LoggedOut) {
          this.isLoggedIn = false
          this.user = undefined
          this.computeIsUserHasAdminAccess()
          console.log('Logged out.')
        } else {
          console.error('Unknown auth status: ' + status)
        }
      }
    )

    this.hotkeysService.cheatSheetToggle.subscribe(isOpen => {
      this.helpVisible = isOpen
    })
  }

  get language () {
    return this.languageChooserModal.getCurrentLanguage()
  }

  get videoLanguages (): string[] {
    if (!this.user.videoLanguages) return [this.i18n('any language')]
    return this.user.videoLanguages
      .map(l => Object.values(pickBy(I18N_LOCALES, (_, key) => startsWith(key, l)))[0])
      .map(v => v === undefined ? '?' : v)
  }

  get nsfwPolicy () {
    switch (this.user.nsfwPolicy) {
      case 'do_not_list':
        return this.i18n('hide')
      case 'blur':
        return this.i18n('blur')
      case 'display':
        return this.i18n('display')
    }
  }

  isRegistrationAllowed () {
    return this.serverConfig.signup.allowed &&
           this.serverConfig.signup.allowedForCurrentIP
  }

  getFirstAdminRightAvailable () {
    const user = this.authService.getUser()
    if (!user) return undefined

    const adminRights = [
      UserRight.MANAGE_USERS,
      UserRight.MANAGE_SERVER_FOLLOW,
      UserRight.MANAGE_VIDEO_ABUSES,
      UserRight.MANAGE_VIDEO_BLACKLIST,
      UserRight.MANAGE_JOBS,
      UserRight.MANAGE_CONFIGURATION
    ]

    for (const adminRight of adminRights) {
      if (user.hasRight(adminRight)) {
        return adminRight
      }
    }

    return undefined
  }

  getFirstAdminRouteAvailable () {
    const right = this.getFirstAdminRightAvailable()

    return this.routesPerRight[right]
  }

  logout (event: Event) {
    event.preventDefault()

    this.authService.logout()
    // Redirect to home page
    this.redirectService.redirectToHomepage()
  }

  openLanguageChooser () {
    this.languageChooserModal.show()
  }

  openHotkeysCheatSheet () {
    this.hotkeysService.cheatSheetToggle.next(!this.helpVisible)
  }

  openQuickSettings () {
    this.quickSettingsModal.show()
  }

  toggleUseP2P () {
    console.log('toggleUseP2P called but nothing done because it is not implemented')
  }

  private computeIsUserHasAdminAccess () {
    const right = this.getFirstAdminRightAvailable()

    this.userHasAdminAccess = right !== undefined
  }
}
