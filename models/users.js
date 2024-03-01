const mongoose = require('mongoose')
const Schema=mongoose.Schema;

const users=new Schema({
    userName:{type:String,required:true},
    password:{type:String,required:true},
    email:{type:String,required:true},
    phoneNumber:{type:String,required:true},
    userImageIconResourcePath:{type:String},
    uploadedVideos:{type:[String],default:[]},
    subscriberCount:{type:Number,default:0},
    subscribedChannels:{type:Number,default:0},
    subscribedChannelIds:{type:[String]},
    likedVideos:{type:[String]},
    dislikedVideos: {type:[String]}
})

var Users=mongoose.model('Users',users)
module.exports=Users