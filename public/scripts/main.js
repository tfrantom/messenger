/**
 * @fileoverview
 * Provides the JavaScript interactions for all pages.
 *
 * @author 
 * Tyler Frantom
 */

/** namespace. */
var rhit = rhit || {};

rhit.COLLECTION_MESSAGES = 'messages'

rhit.intervalId = null;

rhit.authManager = {};
rhit.profileManager = {};

rhit.Message = class {
	constructor(sender, recipient, message, timeSent) {
		this.sender = sender;
		this.recipient = recipient;
		this.message = message;
		this.timeSent = timeSent;
	}
}

rhit.LoginPageController = class {
	constructor() {
		rhit.startFirebaseUI();
		document.querySelector('#registerButton').onclick = (event) => {
			this.createAccount();
		}
		document.querySelector('#loginButton').onclick = (event) => {
			const inputEmail = document.querySelector('#inputEmail');
			const inputPassword = document.querySelector('#inputPassword');
			
			rhit.authManager.signIn(inputEmail.value, inputPassword.value);
		};

	}
	createAccount() {
		const inputEmail = document.querySelector('#inputEmail');
		const inputPassword = document.querySelector('#inputPassword');

		rhit.authManager.createAccount(inputEmail.value, inputPassword.value);
	}	
}

rhit.ProfileManager = class {
	constructor() {
		this._recipient = null;
		console.log('profile manager!!!');
		this._documentSnapshots = [];
		this._ref = firebase.firestore().collection(rhit.COLLECTION_MESSAGES);
		this._unsubscribe = null;
	}

	get recipient() {return this._recipient}

	send(message){
		this._ref.add({
			'sender': rhit.authManager.email,
			'recipient': this._recipient,
			'message': message,
			'timeSent': firebase.firestore.Timestamp.now()
		})
		.then((docRef) => {
			console.log('Message made with Id: ', docRef.id);
		})
		.catch((error) => {
			console.log('Error: ', error);
		});
	}

	mostRecent(updateView) {
		this._ref.where('recipient', '==', rhit.authManager.email)
			.orderBy('timeSent', 'desc')
			.limit(5)
			.get()
			.then((querySnapshot) => {
				let messages = [];
				querySnapshot.forEach((doc) => {
					messages.push(new rhit.Message(
						doc.data().sender,
						doc.data().recipient,
						doc.data().message,
						doc.data().timeSent))
				});
				updateView(messages);
			})
	}
	
	getMessages(recipient, updateView){
		this._recipient = recipient;
		console.log(rhit.authManager.email);
		this._ref.where('sender', '==', rhit.authManager.email)
			.where('recipient', '==', recipient)
			.orderBy('timeSent', 'desc').limit(30)
			.get()
			.then((querySnapshot) => {
				let messages = [];
				querySnapshot.forEach((doc) => {
					messages.push(new rhit.Message(
						doc.data().sender,
						doc.data().recipient,
						doc.data().message,
						doc.data().timeSent))
				});
				this._ref.where('sender', '==', recipient)
					.where('recipient', '==', rhit.authManager.email)
					.orderBy('timeSent', 'desc')
					.get()
					.then((snapshot) => {
						snapshot.forEach((doc) => {
							messages.push(new rhit.Message(
								doc.data().sender,
								doc.data().recipient,
								doc.data().message,
								doc.data().timeSent))
						});
						messages.sort((x, y) => {return y.timeSent - x.timeSent;});
						updateView(messages);
					});
				
			});

	}


}

function htmlToElement(html) {
	var template = document.createElement("template");
	html = html.trim();
	template.innerHTML = html;
	console.log(html);
	return template.content.firstChild;
}

rhit.ProfilePageController = class {
	constructor() {
		rhit.profileManager = new rhit.ProfileManager()
		document.querySelector('#sendButton').onclick = (event) => {
			const message = document.querySelector('#message');
			const email = document.querySelector('#searchEmail');
			rhit.profileManager.send(message.value);
			rhit.profileManager.getMessages(rhit.profileManager.recipient, this.updateList);
		}
		document.querySelector('#searchButton').onclick = (event) => {
			const email = document.querySelector('#searchEmail');
			rhit.profileManager.getMessages(email.value, this.updateList);
		}
		rhit.profileManager.mostRecent(this.updateRecents);
		rhit.recentsIntervalId = setInterval(() => {
			rhit.profileManager.mostRecent(this.updateRecents);
		}, 10000);

		rhit.intervalId = setInterval(() => {
			console.log('Refreshing, ', rhit.profileManager.recipient);
			if(rhit.profileManager.recipient) {
				console.log('Refreshing');
				rhit.profileManager.getMessages(rhit.profileManager.recipient, this.updateList);
			}
		}, 2000);
	}

	updateRecents(messages) {
		const newList = htmlToElement('<div id="recentContainer"></div>');
		messages.forEach(message => {
			const card = createRecentsCard(message);
			card.onclick = (event) => {
				rhit.profileManager.getMessages(message.sender, rhit.ProfilePageController.updateList);
			}
			newList.appendChild(card);
		});
		const oldList = document.querySelector('#recentContainer');
		oldList.removeAttribute('id');
		oldList.hidden = true;
		oldList.parentElement.appendChild(newList);
	}

	updateList(messages) {
		console.log(messages);
		const newList = htmlToElement('<div id="messageContainer"></div>')
		messages.forEach(message => {
			newList.appendChild(createCard(message));
		});
		const oldList = document.querySelector('#messageContainer');
		oldList.removeAttribute('id');
		oldList.hidden = true;
		oldList.parentElement.appendChild(newList);
		document.querySelector('#titleText').innerHTML = `Tyler's Messenger: ${rhit.profileManager.recipient}`
	}
	
}

function createRecentsCard(message) {
	return htmlToElement(`<div class="card text-white bg-primary mt-1">
	<div class="card-body">
	<div class="card-header text-bold">${message.sender}</div>
	<div class="card-text">${message.message}</div>
	</div></div>`);
}

function createCard(message) {
	if(message.sender == rhit.authManager.email) {
		return htmlToElement(`<div class="card mt-1 justify-content-end">
		<div class="card-body">
		<h4 class="card-title">${message.message}</h4>
		<div class="text-muted">You sent at ${message.timeSent.toDate().toDateString()}</div>
		</div></div>`);
	} else {
		return htmlToElement(`<div class="card mt-1 justify-content-end">
		<div class="card-body">
		<h4 class="card-title">${message.message}</h4>
		<div class="text-muted">${message.sender} sent at ${message.timeSent.toDate().toDateString()}</div>
		</div></div>`);
	}
}






rhit.AuthManager = class {
	constructor() {
		this._user = null;
	}

	beginListening(changeListener) {
		firebase.auth().onAuthStateChanged((user) => {
			this._user = user;
			changeListener();
		});
	}

	signIn(email, password) {

		firebase.auth().signInWithEmailAndPassword(email, password)
		.then((user) => {
			this._user = user;
		})
		.catch((error) => {
			var errorCode = error.code;
			var errorMessage = error.message;
			console.log('Existing account log in error', errorCode, errorMessage);
		});
	}

	logOut() {
		firebase.auth().signOut().then(() => {
			// Sign-out successful.
			console.log('You Are now signed out');
		  }).catch((error) => {
			// An error happened.
			console.log('Sign out error');
		  });
		}
		
	createAccount(email, password) {
		firebase.auth().createUserWithEmailAndPassword(email, password)
		.then((user) => {
			console.log("account created!");
			this._user = user;
		})
		.catch((error) => {
			console.log("Error creating account");
		})
	}
	get isSignedIn() {
		return !!this._user;
	}
	
	get uid() {
		return this._user.uid;
	}

	get email() {
		return this._user.email;
	}
}
rhit.startFirebaseUI = function () {
	var uiConfig = {
        signInSuccessUrl: '/',
        signInOptions: [
          firebase.auth.GoogleAuthProvider.PROVIDER_ID,
        ],
      };

      var ui = new firebaseui.auth.AuthUI(firebase.auth());
      ui.start('#firebaseui-auth-container', uiConfig);
};

rhit.checkForRedirects = function() {
	if (document.querySelector("#loginPage") && rhit.authManager.isSignedIn) {
		window.location.href = `/profile.html?id=${rhit.authManager.uid}`;
		rhit.profileManager = new rhit.ProfileManager();
	}	 
};

rhit.initializePage = function() {
	const urlParams = new URLSearchParams(window.location.search);
	document.querySelector('#logOutButton').onclick = (event) => {
		clearInterval(rhit.intervalId);
		rhit.authManager.logOut();
		window.location.href = '/';
	}
	if(document.querySelector('#loginPage')) {
		console.log("You are on the login page");
		new rhit.LoginPageController();
	}
	if(document.querySelector('#profilePage')) {
		console.log('You are on the profile page');
		new rhit.ProfilePageController();
	}
}



/* Main */
/** function and class syntax examples */
rhit.main = function () {
	console.log('Ready');
	rhit.authManager = new rhit.AuthManager();
	rhit.authManager.beginListening(() => {
		console.log("heard something");
		rhit.checkForRedirects();
		rhit.initializePage();
	});
};

rhit.main();
