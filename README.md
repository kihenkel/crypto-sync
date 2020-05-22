# crypto-sync
crypto-sync is a Node.js application that keeps folder A (unencrypted) and folder B (encrypted) on your local machine in sync.

### What is it for?
The idea behind crypto-sync was a way to be able store sensitive data in cloud storages (eg. Google Drive, Microsoft OneDrive, Dropbox ...) while keeping the security in your hands.
While most cloud storage services do encrypt data on transit and at rest they do handle the keys themselves, which theoretically makes it possible for anyone else than you to access that data.
So the general purpose of this application to add another security level to this process.

However crypto-sync literally just keeps two folders on your machine in sync, so you can use it for whatever you want.

### How does it work?
crypto-sync keeps 2 folders on your machine in sync, with the first one being unencrypted and the second one being its AES-256-encrypted twin. It watches for file changes on both sides and synchronizes it on the fly.
The encrypted folder maintains the exact same file structure as the unencrypted ones with the same file & folder names. *Therefore file & folder names are NOT encrypted!* (the file contents however are)

## First time startup
1. First you need to create a keyfile. This literally can be any file you want. I recommend coming up with a strong password and simply storing it in a text file.
2. Locate the folder you want to encrypt (`-w`) and define the file path to its encrypted twin (`-t`). *The encrypted folder must not exist at this point.*
3. Execute: `node index.js -w /path/to/unencrypted/folder -t /path/to/encrypted/folder -k /path/to/keyfile`
4. This will take care of the initial setup and watch the files. Use this command in the future, too.

### Real world example
Goal: I want to synchronize the folder C:/MyDocuments on both my Windows computer and Mac using Google Drive.
1. Create a keyfile (eg. `C:/mySecretKey.key`)
2. On Windows computer: `node index.js -w C:/MyDocuments -t C:/MyDocumentsEncrypted -k C:/mySecretKey.key`
(the folder `C:/MyDocumentsEncrypted` must NOT exist for this to work)
3. Synchronize the ENCRYPTED (!!) folder `C:/MyDocumentsEncrypted` with Google Drive
4. On Mac: Download & synchronize the Google Drive folder to the location of your choice (eg. `/Users/Bob/MyDocumentsEncrypted`)
5. Copy the keyfile to your Mac in a secure way (eg. using a flash drive). Do NOT use Google Drive for that! (obviously)
6. On Mac: `node index.js -w /Users/Bob/MyDocuments -t /Users/Bob/MyDocumentsEncrypted -k /Users/Bob/mySecretKey.key`
(here the folder `/Users/Bob/MyDocuments` must NOT exist, notice that it's the unencrypted folder since we're going the reverse way)

That's it! You should start crypto-sync everytime when starting both computers in order for the sync to work.
Keep in mind that `-w` should always point to the unencrypted folder and `-t` should always point to the encrypted folder, regardless of how and where you're using it. The application will figure out on its own what to do.

Also needless to say: make sure you don't lose your keyfile. If it's gone you cannot decrypt your files anymore.

## USE AT OWN RISK
crypto-sync creates, modifies, deletes, encrypts and decrypts files automatically (that's what synchronisation and encryption is about, right?). At the moment there is no history or recovery process. In case of an error (caused by the user or the application) files could potentially be lost forever. Therefore USE THE APPLICATION AT YOUR OWN RISK! I recommend storing a backup copy of your data somewhere just in case.

## Startup flags
- `-w, --watch` - The path to the UNENCRYPTED folder
- `-t, --target` - The path to the ENCRYPTED folder
- `-k, --key` - The path to the key file
- `-v, --verbose` - Enables verbose mode, gives you a bit more output

## Stored files
The application stores and maintains two files:
- `crypto-sync/temp/logs.log` - All the logs are stored here. If you're curious what the application did at some point you can look it up here.
- `crypto-sync/temp/syncfile.XYZ-XYZ.json` - This is the persistent storage for the sync process to work in between application startups. It gets updated by the application all the time. You can take a look at it, but modifying it will probably break it. So just leave it as it is.

## FAQs
| Question      | Answer           |
| ------------- |-------------|
| What's the encryption used?    | AES-256 |
| How often is it encrypted?      | Once |
| What is encrypted | The file contents |
| What is NOT encrypted? | File names, folder names |
| Can I make file changes while crypto-sync is not running? | Yes, as long as the file change only happens in ONE of both folders (encrypted or unencrypted). crypto-sync will detect that change and synchronize on startup. If the same file is changed in both the encrypted and unencrypted folder then synchronisation is not possible at the moment. |
| Do I need to leave crypto-sync running? | Yes, that's the whole point of syncing files. I recommend starting crypto-sync with each OS boot (eg. by using a start script) |
