pipeline {
  agent {
    docker {
      image 'node:8'
    }
    
  }
  stages {
    stage('Checkout') {
      steps {
        echo 'Getting source code...'
        checkout scm
      }
    }
    stage('Dependencies') {
      steps {
        sh 'git config --user core.logallrefupdates false'
        sh 'yarn install'
      }
    }
  }
  environment {
    CI = 'true'
  }
}