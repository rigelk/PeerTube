#!groovy

/*
The future of Jenkins and CI/CD is having “Pipelines” as code. Delivery pipelines
are thought of as a first-class entity in Jenkins 2.0. Just like your typical .yml
configuration file from Travis, Circle or other popular CI tools - Jenkins 2.0 has
been released with a similar concept. Jenkins has the capability with a Pipeline
plugin to use Pipelines as code in Jenkinsfiles. Users can now model their software
delivery pipelines much easier. Another key feature is that the Jenkinsfile can
be checked into version control.
*/

pipeline {
  agent {
    docker {
      image 'node:8'
    }
  }
  environment {
    CI = 'true'
  }
  stages {
    stage('Checkout'){
      steps {
        echo 'Getting source code...'
        checkout scm
      }
    }
    stage('Dependencies'){
      steps {
        sh 'git config --system core.logallrefupdates false'
        sh 'yarn install'
      }
    }
  }

}
