var express = require('express');
var router = express.Router();
const Videos = require('../models/videos')
const multer = require('multer');
const Users = require('../models/users');
const Comments = require('../models/comments')
require('dotenv').config()
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const { errorMonitor } = require('events');
const usersecretKey = process.env.SECRET_KEY;
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/videos/')
  },

  filename: (req, file, cb) => {
    const uniqueFilename = Date.now() + '-' + Math.round(Math.random() * 1E9) + '-' + file.originalname;
    cb(null, uniqueFilename);
  }
});

const upload = multer({ storage });

router.post('/upload-video', upload.fields([{ name: 'mp4file' }, { name: 'jpgfile' }]), async (req, res, next) => {
  try {
    const mp4file = req.files['mp4file'][0];
    const jpgfile = req.files['jpgfile'][0];
    if (!mp4file || !jpgfile) {
      const error = new Error('Please attach a file');
      error.statusCode = 400;
      throw error;
    }
    const { videoTitle, videoDescription, channelName, channelId } = req.body;
    const video = new Videos({ videoTitle, videoDescription, channelName, channelId });
    const saveVideo = await video.save();
    const videoResourcePath = `https://chocotv-backend.onrender.com/videos/${saveVideo._id}`;
    const thumbnailResourcePath = `https://chocotv-backend.onrender.com/images/${saveVideo._id}`;
    saveVideo.videoResourcePath = videoResourcePath;
    saveVideo.thumbnailResourcePath = thumbnailResourcePath;
    await saveVideo.save();
    const mp4filename = saveVideo._id + '.mp4'
    const jpgfilename = saveVideo._id + ".jpg"
    fs.renameSync('public/videos/' + mp4file.filename, 'public/videos/' + mp4filename);
    fs.renameSync('public/videos/' + jpgfile.filename, 'public/images/' + jpgfilename);
    if (saveVideo) {
      const user = await Users.findByIdAndUpdate(saveVideo.channelId, { $push: { uploadedVideos: saveVideo._id } })
      if (user) {
        res.json({ msg: 'Success', id: saveVideo._id });
      }
      else {
        res.send("Failure")
      }
    } else {
      res.send('Failure');
    }
  } catch (err) {
    console.error('Error:', err);
    res.status(err.statusCode || 500).send(err.message || 'Internal Server Error');
  }
});

router.post('/register', async (req, res, next) => {
  try {
    const { userName, password, email, phoneNumber } = req.body;
    const userExist = await Users.findOne({ email }).exec()
    if (userExist) {
      res.send({ msg: "failure" })
    }
    else {

      bcrypt.hash(password, 10).then((hash) => {
        const user = new Users({
          userName: userName,
          password: hash,
          email: email,
          phoneNumber: phoneNumber
        });
        return user.save();
      })
        .then(savedUser => {
          res.send({ data: savedUser.$assertPopulated, msg: "success" });
        })
    }

  }
  catch (err) {
    res.send(err)
  }

})
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const userExist = await Users.findOne({ email }).exec();
    if (userExist) {
      const savedPassword = userExist.password;
      bcrypt.compare(password, savedPassword).then((match) => {
        if (!match) {
          res.send("Match Failure")
        }
        else {
          const token = jwt.sign({ userId: userExist._id }, usersecretKey, { expiresIn: '30d' });
          res.cookie('token', token, {
            httpOnly: true,
            secure: false,
            maxAge: 1000 * 60 * 60 * 24 * 60
          })
          res.json({ msg: "Success" })
        }
      })
    }
    else {
      res.send("Failure")
    }
  }
  catch (err) {
    res.send(err)
  }
})
router.post("/fetch-user-data", async (req, res, next) => {

  try {
    const tokenCook = req.cookies.token;
    if (tokenCook) {
      const decoded = jwt.verify(tokenCook, usersecretKey)
      const user = await Users.findById(decoded.userId).exec();

      if (user) {
        res.send({ data: { userName: user.userName, email: user.email, uploadedVideos: user.uploadedVideos, subscriberCount: user.subscriberCount, subscribedChannels: user.subscribedChannels, subscribedChannelIds: user.subscribedChannelIds, likedVideos: user.likedVideos, userId: user._id }, msg: "success" })
      }
      else {
        res.send("Session Expired!")
      }
    }
    else {
      res.send("invalid session")
    }


  }
  catch (err) {
    res.send(err)
  }

})
router.post('/fetch-video', async (req, res, next) => {
  try {
    const videoId = req.body._id
    const video = await Videos.findById(videoId).exec()
    if (video) {
      res.send(video)
    }
    else {
      res.send("not found")
    }
  }
  catch (err) {
    res.send(err)
  }
})
router.post("/fetch-videos", async (req, res, next) => {
  try {
    const videos = await Videos.find().exec()
    if (videos && videos.length > 0) { // Check if videos array is not empty
      const formattedVideos = videos.map(video => ({
        videoTitle: video.videoTitle,
        viewCount: video.viewCount,
        thumbnailResourcePath: video.thumbnailResourcePath,
        videoId: video._id,
        uploadDate: video.uploadDate,
        channelName: video.channelName
      }));
      res.json({ data: formattedVideos });
    }
    else {
      res.send("failure")
    }

  }
  catch (err) {
    res.send(err)
  }
})
router.post("/handle-like", async (req, res, next) => {
  try {
    const tokenCook = req.cookies.token;
    const { likeStatus, videoId } = req.body

    if (tokenCook) {
      const decode = jwt.verify(tokenCook, usersecretKey)
      const userExs = await Users.findById(decode.userId).exec()
      if (userExs) {
        const video = await Videos.findById(videoId)
        const dislikeHistory = userExs.dislikedVideos.filter(id => id == videoId)
        const likeHistory = userExs.likedVideos.filter(id => id == videoId)
        if (likeHistory.length >= 1) {
          if (likeStatus == "default flag") {
            res.send({ likeStatus: "liked" })
          }
          else if (likeStatus == "false") {
            if (video.likeCount > 0) {
              video.likeCount -= 1
              await video.save()
            }
            userExs.likedVideos = userExs.likedVideos.filter(id => id !== videoId);
            await userExs.save();
            res.send({ msg: "Unliked", data: video })

          }

          else {
            res.send("Already liked")
          }

        }
        else if (likeStatus == "true") {
          if (video) {


            video.likeCount += 1
            await video.save()
            userExs.likedVideos.push(videoId)
            await userExs.save()
            res.send({ msg: "Liked", data: video })


          }
          else {
            res.send("Unable to locate video")
          }
        }
        else {
          res.send("error occured")
        }

      }
      else {
        res.send("Such user doesnt exist!")
      }
    }
    else {
      res.send("Token not found")
    }

  }
  catch (err) {
    console.log(err)
  }
})

router.post("/handle-dislike", async (req, res, next) => {
  try {
    const tokenCook = req.cookies.token;
    const { dislikeStatus, videoId } = req.body

    if (tokenCook) {
      const decode = jwt.verify(tokenCook, usersecretKey)
      const userExs = await Users.findById(decode.userId).exec()
      if (userExs) {
        const video = await Videos.findById(videoId)
        const dislikeHistory = userExs.dislikedVideos.filter(id => id == videoId)
        const likeHistory = userExs.likedVideos.filter(id => id == videoId)
        console.log(dislikeHistory)
        if (dislikeHistory.length >= 1) {
          if (dislikeStatus == "default flag") {
            res.send({ dislikeStatus: "disliked" })
          }
          else if (dislikeStatus == "false") {
            if (video.dislikeCount > 0) {
              video.dislikeCount -= 1
              await video.save()
            }
            userExs.dislikedVideos = userExs.dislikedVideos.filter(id => id !== videoId);
            await userExs.save();
            res.send({ msg: "Undisliked", data: video })

          }

          else {
            res.send("Already disliked")
          }

        }
        else if (dislikeStatus == "true") {
          if (video) {


            video.dislikeCount += 1
            await video.save()
            userExs.dislikedVideos.push(videoId)
            await userExs.save()
            res.send({ msg: "disliked", data: video })


          }
          else {
            res.send("Unable to locate video")
          }
        }
        else {
          res.send("error occured")
        }

      }
      else {
        res.send("Such user doesnt exist")
      }
    }
    else {
      res.send("Token not found")
    }

  }
  catch (err) {
    console.log(err)
  }
})

router.post('/register-view', async (req, res, next) => {
  try {
    const { videoId } = req.body;
    const video = await Videos.findById(videoId).exec()
    if (video) {
      video.viewCount += 1;
      await video.save()
      res.send("View counted")
    }
    else {
      res.send("Video not found")
    }
  }
  catch (err) {
    res.send(err)
  }
})
router.post('/handle-subscription', async (req, res, next) => {
  try {
    const { channelId, status } = req.body
    const tokenCook = req.cookies.token
    console.log(status)
    if (tokenCook) {
      const decode = jwt.verify(tokenCook, usersecretKey)
      const userExs = await Users.findById(decode.userId).exec()
      const subsHistory = userExs.subscribedChannelIds.filter((id) => id == channelId)
      if (subsHistory.length == 1) {
        console.log(subsHistory.length)
        if (status == "default flag") {
          res.send({ msg: "is subscribed" })
        }
        else if (status == "unsubscribe" && subsHistory.length == 1) {
          userExs.subscribedChannelIds = userExs.subscribedChannelIds.filter(id => id !== channelId);
          await userExs.save()
          if (userExs.subscribedChannels > 0) {
            userExs.subscribedChannels -= 1
            await userExs.save()
          }
          chanExs = await Users.findById(channelId).exec()
          if (chanExs.subscriberCount > 0) {
            chanExs.subscriberCount -= 1
            await chanExs.save()
          }
          res.send({ msg: "unsubscribed!" })
        }
        else {
          res.send("error!");
        }
      }
      else {
        if (userExs) {
          if (status == "subscribe") {
            if (channelId) {
              userExs.subscribedChannelIds.push(channelId)
              await userExs.save()
            }

            userExs.subscribedChannels += 1
            await userExs.save()
            chanExs = await Users.findById(channelId).exec()
            chanExs.subscriberCount += 1
            await chanExs.save()
            res.send({ msg: "subscribed!" })
          }
          else {
            res.send("Failure")
          }

        }
        else {
          res.send("user not found")
        }

      }

    }
    else {
      res.send("Invalid user")
    }
  }
  catch (err) {
    res.send(err)
  }
})

router.post('/fetch-channel-data', async (req, res, next) => {
  try {
    const { channelId } = req.body;
    const channelExs = await Users.findById(channelId).exec()
    if (channelExs) {
      res.send({ subscriberCount: channelExs.subscriberCount, channelName: channelExs.userName, uploadedVideos: channelExs.uploadedVideos })
    }
    else {
      res.send("invalid channel id")
    }
  }
  catch (err) {
    res.send(err)
  }
})

router.post('/logout', async (req, res, next) => {
  try {
    const tokenCookie = req.cookies.token
    if (tokenCookie) {
      res.cookie('token', "invalid token", {
        httpOnly: true,
        secure: false,
        maxAge: 1000 * 60 * 60 * 24 * 60,
      })
      res.send("Successfully logged out!")
    }
    else {
      res.send("Invalid request")
    }
  }
  catch (err) {
    res.send(err)
  }
})

router.post("/fetch-byId", async (req, res, next) => {
  try {
    const { idArray, option } = req.body;
    let videoObjectCollection = []

    if (option == "likes") {
      await Promise.all(
        idArray.map(async (ids) => {
          let video = await Videos.findById(ids).exec()
          videoObjectCollection.push(video)
        })
      )
      videoObjectCollection = videoObjectCollection.filter((video) => video.length !== 0)
      res.send(videoObjectCollection)
    }
    else if (option == "subscriptions") {
      await Promise.all(
        idArray.map(async (ids) => {
          let video = await Videos.find({ channelId: ids }).exec()
          videoObjectCollection.push(video)
        })
      )
      videoObjectCollection = videoObjectCollection.filter((video) => video.length !== 0)
      res.send(videoObjectCollection)
    }
    else {
      res.send("Invalid!")
    }



  }
  catch (err) {
    res.send(err)
  }
})
router.post('/delete-video', async (req, res, next) => {
  try {
    const tokenCookie = req.cookies.token
    const { videoId } = req.body
    if (tokenCookie) {
      const decode = jwt.verify(tokenCookie, usersecretKey)
      const userExs = await Users.findById(decode.userId).exec()
      if (userExs) {
        let filter = userExs.uploadedVideos.filter(id => id === videoId)
        if (filter.length > 0) {
          const video = await Videos.findByIdAndDelete(videoId).exec()
          if (video) {
            userExs.uploadedVideos = userExs.uploadedVideos.filter(id => id !== videoId)
            await userExs.save()
            res.send(userExs)
          }
          else {
            res.send("failure")
          }
        }
        else {
          res.send("video not found")
        }
      }
      else {
        res.send("Session Expired!")
      }
    }
    else {
      res.send("Unauthorized")
    }
  }
  catch (err) {
    res.send(err)
  }
})

router.post('/register-comment', async (req, res, next) => {
  try {
    const tokenCookie = req.cookies.token;
    const { commentBody, videoId } = req.body;
    if (tokenCookie) {
      const decode = jwt.verify(tokenCookie, usersecretKey)
      const userExs = await Users.findById(decode.userId).exec()
      if (userExs) {
        const comment = new Comments({ commentBody: commentBody, userId: userExs._id, videoId: videoId, userName: userExs.userName })
        await comment.save()
        if (comment) {
          const data = await Comments.find({ videoId: videoId }).exec()
          res.send(data)
        }
        else {
          res.send("Failure")
        }
      }
      else {
        res.send("User not found")
      }
    }
    else {
      res.send("Invaild Session")
    }
  }
  catch (err) {
    res.send(err)
  }
})

router.post('/fetch-comments', async (req, res, next) => {
  try {
    const { videoId } = req.body
    const comments = await Comments.find({ videoId: videoId }).exec()
    if (comments) {
      res.send(comments)
    }
    else {
      res.send("fetch failed")
    }
  }
  catch (err) {
    res.send(err)
  }
})

router.get('/video/:filename', (req, res) => {
  const { filename } = req.params;
  const videoPath = path.join(__dirname, '..', 'public', 'videos', filename);
  console.log(videoPath)
  if (fs.existsSync(videoPath)) {
    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;

    // Parse Range header from the request
    const range = req.headers.range;

    if (range) {
      // Parse range values
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      // Calculate chunk size and create Readable stream with appropriate range
      const chunkSize = (end - start) + 1;
      const fileStream = fs.createReadStream(videoPath, { start, end });

      // Set response headers
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': 'video/mp4'
      });

      // Pipe the Readable stream to response
      fileStream.pipe(res);
    } else {
      // No Range header provided, serve the entire file
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4'
      });

      // Create Readable stream for the entire file and pipe it to response
      const fileStream = fs.createReadStream(videoPath);
      fileStream.pipe(res);
    }
  } else {
    res.status(404).send('Video not found');
  }
});
module.exports = router;
