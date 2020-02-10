import * as firebase from 'firebase/app'
import 'firebase/auth'
const firebaseApp = firebase.initializeApp({
  apiKey: 'AIzaSyAPp8UYTnlz28nfVColD3IXK2olX8Ztbag',
  authDomain: 'bittube-airtime-extension.firebaseapp.com',
  databaseURL: 'https://bittube-airtime-extension.firebaseio.com',
  projectId: 'bittube-airtime-extension',
  storageBucket: 'bittube-airtime-extension.appspot.com',
  messagingSenderId: '632275942486'
})
const firebaseClass = firebase
const getFirebaseToken = (forceRefresh = false) =>
  (firebaseApp.auth().currentUser ? firebaseApp.auth().currentUser.getIdToken(forceRefresh) : null)

export { firebaseApp, firebaseClass, getFirebaseToken }
