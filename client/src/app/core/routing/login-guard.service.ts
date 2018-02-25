import { Injectable } from '@angular/core'
import {
  ActivatedRouteSnapshot,
  CanActivateChild,
  RouterStateSnapshot,
  CanActivate,
  Router,
  NavigationExtras
} from '@angular/router'

import { AuthService } from '../auth/auth.service'

@Injectable()
export class LoginGuard implements CanActivate, CanActivateChild {

  constructor (
    private router: Router,
    private auth: AuthService
  ) {}

  canActivate (route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean {
    if (this.auth.isLoggedIn() === true) return true

    // Store the attempted URL for redirecting
    this.auth.redirectUrl = state.url

    // Navigate to the login page with extras
    this.router.navigate([ '/login' ])
    return false
  }

  canActivateChild (route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean {
    return this.canActivate(route, state)
  }
}
