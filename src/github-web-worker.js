const api = {
  url: 'https://api.github.com/gists',
  gistDescription: 'atom.io project-viewer backup files',
  token: undefined,
  gistId: undefined,
  setName: 'default',
  get gistFileName() {
    return `project-viewer-${this.setName}.json`;
  },
  connectionError: function connectionError(error) {
    return {
      type: 'error',
      message: `Failed to connect to <strong>GitHub</strong> servers: ${error.message}`,
      options: {
        icon: 'mark-github'
      }
    };
  },
  // helper function to check whether given configuration value is defined
  checkConfig: function checkConfig(value, name) {
    const promise = new Promise((resolve, reject) => {

      // check if given value is defined
      if (value) {
        resolve();
        return;
      }

      reject({
        type: 'warning',
        message: `No <strong>${name}</strong> was provided, please check the configuration.`,
        options: {
          icon: 'mark-github'
        }
      });
    });

    return promise;
  },
  getGist: function getGist() {
    const promise = new Promise((resolve, reject) => {
      let url = this.url + '/' + this.gistId;

      let headers = new Headers();
      headers.append('Accept', 'application/vnd.github.v3+json');
      headers.append('Authorization', `token ${this.token}`);

      let parameters = {
        method: 'GET',
        headers: headers
      };

      fetch(url, parameters)
        .then(this.toJson.bind(null, 200))
        .then(data => {
          if (data && data.files && data.files.hasOwnProperty(this.gistFileName)) {
            // backup found, returning
            resolve({
              type: 'success',
              message: 'Retrieved DB from <strong>GitHub</strong> successfully.',
              db: JSON.parse(data.files[this.gistFileName].content),
              options: {
                icon: 'mark-github'
              }
            });
            return;
          }

          // backup not found, response status code was not 200 OK
          // either gist with given ID doesnt exist (user hasnt created the gist yet or it has been deleted) or user has no existing backup
          reject({
            type: 'warning',
            message: `No backup found under gist ID [${this.gistId}] for set [${this.setName}]. Make sure that gist with given ID exists under your private gists and that you have an existing backup (call backup -> call import).`,
            options: {
              icon: 'mark-github',
              dismissable: true
            }
          });
        }).catch(error => {
          reject(this.connectionError(error));
        });
    });

    return promise;
  },
  updateGist: function updateGist(value) {
    const promise = new Promise((resolve, reject) => {
      let url = this.url + '/' + this.gistId;

      let headers = new Headers();
      headers.append('Accept', 'application/vnd.github.v3+json');
      headers.append('Authorization', `token ${this.token}`);

      let files = {};
      files[this.gistFileName] = {
        content: JSON.stringify(value)
      };

      let body = JSON.stringify({
        description: this.gistDescription,
        public: false,
        files: files
      });

      parameters = {
        method: 'PATCH',
        headers: headers,
        body: body
      };

      fetch(url, parameters)
        .then((response) => {
          if (response.status == 200) {
            // gist successfully updated
            resolve({
              type: 'success',
              message: 'Successfully backed up the DB.',
              options: {
                icon: 'mark-github'
              }
            });
            return;
          }

          // failed to update gist, reponse status code was not 200 OK
          reject({
            type: 'warning',
            message: 'Failed to update gist.',
            options: {
              icon: 'mark-github'
            }
          });
        }).catch(error => {
          reject(this.connectionError(error));
        });
    });

    return promise;
  },
  checkIfGistExists: function checkIfGistExists() {
    const promise = new Promise((resolve, reject) => {
      let url = this.url + '/' + this.gistId;

      let headers = new Headers();
      headers.append('Accept', 'application/vnd.github.v3+json');
      headers.append('Authorization', `token ${this.token}`);

      let parameters = {
        method: 'GET',
        headers: headers,
      };

      fetch(url, parameters)
        .then(response => {
          if (response.status == 200) {
            // gist exists
            resolve();
            return;
          }

          // gist doesn't exist
          reject({
            type: 'warning',
            message: `No gist found with ID [${this.gistId}]. Specify valid gist ID or specify empty gist ID and we will create a gist for you.`,
            options: {
              icon: 'mark-github',
              dismissable: true
            }
          });
        }).catch(error => {
          reject(this.connectionError(error));
        });
    });

    return promise;
  },
  createNewGist: function createNewGist(value) {
    const promise = new Promise((resolve, reject) => {
      let headers = new Headers();
      headers.append('Accept', 'application/vnd.github.v3+json');
      headers.append('Authorization', `token ${this.token}`);

      let files = {};
      files[this.gistFileName] = {
        content: JSON.stringify(value)
      };

      let body = JSON.stringify({
        description: this.gistDescription,
        public: false,
        files: files
      });

      let parameters = {
        method: 'POST',
        headers: headers,
        body: body
      };

      fetch(this.url, parameters)
        .then(this.toJson.bind(null, 201))
        .then(data => {
          if (data && data.id) {
            // gist successfully created
            this.gistId = data.id;

            resolve({
              type: 'success',
              message: `Successfully created gist ID [${data.id}] and backed up the DB.`,
              options: {
                icon: 'mark-github'
              },
              gistId: data.id
            });
            return;
          }

          // failed to craete gist, response status code was not 201 Created
          reject({
            type: 'warning',
            message: 'Failed to create gist.',
            options: {
              icon: 'mark-github'
            }
          });
        }).catch(error => {
          reject(this.connectionError(error));
        });
    });

    return promise;
  },
  // orchestration function for update operation
  updateOperation: function updateOperation(value) {
    const promise = new Promise((resolve, reject) => {
      if (this.gistId) {
        // user provided gist id, check if gist exists (if yes update, otherwise reject)
        this.checkIfGistExists()
          .then(() => {
            this.updateGist(value).then(resolve).catch(reject);
          }).catch(reject);
      } else {
        // user didnt specify gist id, create gist for him and set it in config
        this.createNewGist(value).then(resolve).catch(reject);
      }
    });

    return promise;
  },
  // orchestration function for fetch operation
  fetchOperation: function fetchOperation() {
    const promise = new Promise((resolve, reject) => {
      this.getGist().then(resolve).catch(reject);
    });

    return promise;
  },
  // helper function to check whether the response status code equals the requiredStatusCode and return json promise if so
  // we then check in Promise.then() if data exists (exists only if response respones status code matched)
  toJson: function toJson(requiredStatusCode, response) {
    if (response.status == requiredStatusCode) {
      return response.json();
    }
    return Promise.resolve(undefined);
  }
};

onmessage = function(e) {
  if (!e.data || e.data.length === 0) {
    return;
  }

  if (e.data[0].hasOwnProperty('token')) {
    api.token = e.data[0].token;
  }

  if (e.data[0].hasOwnProperty('gistId')) {
    api.gistId = e.data[0].gistId;
  }

  if (e.data[0].hasOwnProperty('setName')) {
    api.setName = e.data[0].setName;
  }

  if (e.data[0].action === 'fetch') {
    Promise.all([api.checkConfig(api.token, 'Github Access Token'), api.checkConfig(api.gistId, 'Gist ID')])
      .then(() => {
        api.fetchOperation()
          .then(postMessage)
          .catch(postMessage);
      })
      .catch(postMessage);
  } else if (e.data[0].action === 'update') {
    Promise.all([api.checkConfig(api.token, 'Github Access Token')])
      .then(() => {
        api.updateOperation(e.data[0].value)
          .then(postMessage)
          .catch(postMessage);
      })
      .catch(postMessage);
  }
}
