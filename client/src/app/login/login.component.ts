import { Component, ElementRef, OnInit, ViewChild } from '@angular/core'
import { Notifier, RedirectService } from '@app/core'
import { UserService } from '@app/shared'
import { AuthService } from '../core'
import { FormReactive } from '../shared'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { FormValidatorService } from '@app/shared/forms/form-validators/form-validator.service'
import { LoginValidatorsService } from '@app/shared/forms/form-validators/login-validators.service'
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap'
import { ActivatedRoute } from '@angular/router'
import { ServerConfig } from '@shared/models/server/server-config.model'

// Firebase shim
// import { app as firebase, firebase as firebaseClass, getFirebaseToken } from '../../../lib/firebase/client'
import * as firebase from 'firebase/app'
import 'firebase/auth'
const firebaseApp = firebase.initializeApp({
  apiKey: "AIzaSyAPp8UYTnlz28nfVColD3IXK2olX8Ztbag",
  authDomain: "bittube-airtime-extension.firebaseapp.com",
  databaseURL: "https://bittube-airtime-extension.firebaseio.com",
  projectId: "bittube-airtime-extension",
  storageBucket: "bittube-airtime-extension.appspot.com",
  messagingSenderId: "632275942486"
})
const firebaseClass = firebase
const getFirebaseToken = (forceRefresh = false) => (firebaseApp.auth().currentUser ? firebaseApp.auth().currentUser.getIdToken(forceRefresh) : null)
// ^ TODO: Move to own file

@Component({
  selector: 'my-login',
  templateUrl: './login.component.html',
  styleUrls: [ './login.component.scss' ]
})

export class LoginComponent extends FormReactive implements OnInit {
  @ViewChild('emailInput', { static: true }) input: ElementRef
  @ViewChild('forgotPasswordModal', { static: true }) forgotPasswordModal: ElementRef

  error: string = null
  forgotPasswordEmail = ''

  private openedForgotPasswordModal: NgbModalRef
  private serverConfig: ServerConfig

  constructor (
    protected formValidatorService: FormValidatorService,
    private route: ActivatedRoute,
    private modalService: NgbModal,
    private loginValidatorsService: LoginValidatorsService,
    private authService: AuthService,
    private userService: UserService,
    private redirectService: RedirectService,
    private notifier: Notifier,
    private i18n: I18n
  ) {
    super()
  }

  get signupAllowed () {
    return this.serverConfig.signup.allowed === true
  }

  isEmailDisabled () {
    return this.serverConfig.email.enabled === false
  }

  ngOnInit () {
    this.serverConfig = this.route.snapshot.data.serverConfig

    this.buildForm({
      username: this.loginValidatorsService.LOGIN_USERNAME,
      password: this.loginValidatorsService.LOGIN_PASSWORD
    })

    this.input.nativeElement.focus()
  }

  social_login (event: Event, network: string) {
    event.preventDefault()

    let authProvider = null

    switch (network) {
      case 'facebook':
        authProvider = new firebaseClass.auth.FacebookAuthProvider()
        break;
      case 'google':
        authProvider = new firebaseClass.auth.GoogleAuthProvider()
        break;
      case 'twitter':
        authProvider = new firebaseClass.auth.TwitterAuthProvider()
        break;
      default:
    }

    firebase.auth().signInWithPopup(authProvider).then(
      async (result) => {
        const username = result.user.email
        const password = await getFirebaseToken()

        this.authService.login(username, password)
        .subscribe(
          () => this.redirectService.redirectToPreviousRoute(),

          err => {
            if (err.message.indexOf('credentials are invalid') !== -1) this.error = this.i18n('Incorrect username or password.')
            else if (err.message.indexOf('blocked') !== -1) this.error = this.i18n('You account is blocked.')
            else this.error = err.message
          }
        )
      },
      err => this.error = err.message
    );
  }

  login () {
    this.error = null

    const { username, password } = this.form.value

    this.authService.login(username, password)
      .subscribe(
        () => this.redirectService.redirectToPreviousRoute(),

        err => {
          if (err.message.indexOf('credentials are invalid') !== -1) this.error = this.i18n('Incorrect username or password.')
          else if (err.message.indexOf('blocked') !== -1) this.error = this.i18n('You account is blocked.')
          else this.error = err.message
        }
      )
  }

  askResetPassword () {
    this.userService.askResetPassword(this.forgotPasswordEmail)
      .subscribe(
        () => {
          const message = this.i18n(
            'An email with the reset password instructions will be sent to {{email}}. The link will expire within 1 hour.',
            { email: this.forgotPasswordEmail }
          )
          this.notifier.success(message)
          this.hideForgotPasswordModal()
        },

        err => this.notifier.error(err.message)
      )
  }

  openForgotPasswordModal () {
    this.openedForgotPasswordModal = this.modalService.open(this.forgotPasswordModal)
  }

  hideForgotPasswordModal () {
    this.openedForgotPasswordModal.close()
  }
}
