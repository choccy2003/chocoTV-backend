const mongoose=require('mongoose')
const Schema=mongoose.Schema
const date = Date.now();
const videos= new Schema(
    {
        videoTitle:{type:String,required:true},
        viewCount:{type:Number,default:0},
        likeCount:{type:Number,default:0},
        dislikeCount:{type:Number,default:0},
        videoResourcePath:{type:String},
        thumbnailResourcePath:{type:String},
        subscriberCount:{type:Number,default:0},
        channelName:{type:String,required:true},
        channelIconResourcePath:{type:String},
        uploadDate:{type:String,default:date},
        videoDescription:{type:String,required:true},
        channelId:{type:String,required:true},
    }
)

var Videos = mongoose.model('Videos', videos)
module.exports = Videos