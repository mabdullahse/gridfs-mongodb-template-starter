
const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const { GridFsStorage } = require('multer-gridfs-storage');
const Grid = require('gridfs-stream');
const crypto = require('crypto');
const path = require('path');

const app = express();
const mongoURI = 'mongodb://localhost:27017/learngridfs';
const conn = mongoose.createConnection(mongoURI);


/**
 * Storage For files 
 */
// Create storage engine
const storage = new GridFsStorage({
    db: conn,
    options: { useUnifiedTopology: true, useNewUrlParser: true },
    file: (req, file) => {
        return new Promise((resolve, reject) => {
            crypto.randomBytes(16, (err, buf) => {
                if (err) {
                    return reject(err);
                }
                const filename = buf.toString('hex') + path.extname(file.originalname);
                const fileInfo = {
                    filename: filename,
                    bucketName: 'fs'
                };
                resolve(fileInfo);
            });
        });

        return {
            filename: 'file_' + Date.now() + '_' + file.originalname.replace(/\s/g, '')
        };
    }
});
// Initiate multer upload middleware
const upload = multer({ storage });


// Route to upload file
app.post('/upload', upload.single('file'), (req, res) => {
    res.json({ file: req.file });
});


/**
 * Get the file
 */
// Create GridFS stream
let gfs, gridFsBucket;
conn.once('open', () => {
    console.log('Db has been connected');


    gridFsBucket = new mongoose.mongo.GridFSBucket(conn.db, {
        bucketName: 'fs'
    });

    gfs = Grid(conn.db, mongoose.mongo);
    gfs.collection('fs');
});


// Serve files from GridFS
app.get('/files/:id', (req, res) => {
    gfs.files.findOne({ _id: mongoose.Types.ObjectId(req.params.id) }, (err, file) => {
        if (err || !file) {
            return res.status(404).send('File not found');
        }
        res.set('Content-Type', file.contentType);
        const readstream = gridFsBucket.openDownloadStream(file._id);
        readstream.pipe(res);
    });
});

app.delete('/files/:id', (req, res) => {
    gridFsBucket.delete(mongoose.Types.ObjectId(req.params.id), function (err, result) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ message: 'File deleted successfully' });
    });
});


app.listen(3000, () => {
    console.log('Server started on port 3000');
});
