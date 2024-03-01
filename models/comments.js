const mongoose = require("mongoose")
const Schema = mongoose.Schema;

const comments = new Schema({
    userId: { type: String, required: true },
    commentBody: { type: String, required: true },
    userName: { type: String, required: true },
    videoId: { type: String, required: true },
}

)

var Comments = mongoose.model("Comments", comments)
module.exports = Comments