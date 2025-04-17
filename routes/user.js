const { ImageUpload } = require('../models/imageUpload');
const { User } = require('../models/user');
const { sendEmail } = require('../utils/emailService');

const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require("jsonwebtoken");

const multer  = require('multer');

const fs = require("fs");

const cloudinary = require('cloudinary').v2;

cloudinary.config({
    cloud_name: process.env.cloudinary_Config_Cloud_Name,
    api_key: process.env.cloudinary_Config_api_key,
    api_secret: process.env.cloudinary_Config_api_secret,
    secure: true
});

var imagesArr=[];

const storage = multer.diskStorage({

    destination: function (req, file, cb) {
      cb(null, "uploads");
    },
    filename: function (req, file, cb) {
      cb(null, `${Date.now()}_${file.originalname}`);
    },
})

const upload = multer({ storage: storage })

router.post(`/upload`, upload.array("images"), async (req, res) => {
    imagesArr=[];
    try{

        for (let i = 0; i < req.files.length; i++) {

            const options = {
                use_filename: true,
                unique_filename: false,
                overwrite: false,
            };

            const img = await cloudinary.uploader.upload(req.files[i].path, options,
                function (error, result) {
                    imagesArr.push(result.secure_url);
                    fs.unlinkSync(`uploads/${req.files[i].filename}`);
                });
        }

        let imagesUploaded = new ImageUpload({
            images: imagesArr,
        });

        imagesUploaded = await imagesUploaded.save();
        return res.status(200).json(imagesArr);

    }catch(error){
        console.log(error);
        return res.status(500).json({ error: true, msg: "Upload failed" });
    }

});


router.post(`/signup`, async (req, res) => {
    const { name, phone, email, password, isAdmin } = req.body;

    try {

        const verifyCode = Math.floor(100000 + Math.random() * 900000).toString();
        let user;

        const existingUser = await User.findOne({ email: email });
        const existingUserByPh = await User.findOne({ phone: phone });

        if (existingUser && existingUserByPh) {
            return res.json({ status: "FAILED", msg: "User already exists!" });
        }
        
        if(existingUser) {
            const hashPassword = await bcrypt.hash(password, 10);
            existingUser.password = hashPassword;
            existingUser.otp = verifyCode;
            existingUser.otpExpires = Date.now() + 600000;
            await existingUser.save();
            user = existingUser;
        } else {
            const hashPassword = await bcrypt.hash(password, 10);

            user = new User({
                name,
                email,
                phone,
                password:hashPassword,
                isAdmin,
                otp: verifyCode,
                otpExpires: Date.now() + 600000,
        });
            await user.save();
        }

        const resp = sendEmailFun(email, "Verify Email", "", "Your OTP is "+verifyCode);

        const token = jwt.sign({email:user.email, id: user._id}, process.env.JSON_WEB_TOKEN_SECRET_KEY);

        return res.status(200).json({
            success:true,
            message: "User registered successfullt! Please verify your email.",
            token:token
        });

    } catch (error) {
        console.log(error);
        res.json({status:'FAILED', msg:"something went wrong"});
        return;
    }
})


router.post(`/verifyAccount/resendOtp`, async(req, res) => {
    const { email } = req.body;

    try {

        const verifyCode = Math.floor(100000 + Math.random() * 900000).toString();

        const existingUser = await User.findOne({ email: email });

        if (existingUser) {
            return res.status(200).json({
                success: true,
                message: "OTP SEND",
                otp:verifyCode,
                existingUserId:existingUser._id
            });
        }
    } catch (error) {
        console.log(error);
        res.json({status:'FAILED', msg:"something went wrong"});
        return;
    }
})


router.put(`/verifyAccount/emailVerify/:id`, async(req, res) => {
    const {email, otp} = req.body;
    try {

        const existingUser = await User.findOne({ email: email});

        console.log(existingUser)

        if (existingUser) {
            const user = await User.findByIdAndUpdate(
                req.params.id,
                {
                    name:existingUser.name,
                    email:email,
                    phone:existingUser.phone,
                    password:existingUser.password,
                    images: existingUser.images,
                    isAdmin: existingUser.isAdmin,
                    isVerified: existingUser.isVerified,
                    otp:otp,
                    otpExpires:Date.now() + 600000,
                },
                { new: true }
            )
        }

        const resp = sendEmailFun(email, "verify Email", "", "Your OTP is"+otp);

        const token = jwt.sign(
            { email: existingUser.email, id: existingUser._id },
            process.env.JSON_WEB_TOKEN_SECRET_KEY
        );

        return res.status(200).json({
            success: true,
            message: "OTP SEND",
            toke: token,
            otp:verifyCode,
            existingUserId:existingUser._id
        });
    } catch (error) {
        console.log(error);
        res.json({status:'FAILED', msg:"something went wrong"});
        return;
    }
})

const sendEmailFun = async(to, subject, text, html)=>{
    const result = await sendEmail(to, subject, text, html);
    if(result.success) {
        return true;
    } else {
        return false;
    }
}


router.post(`/verifyemail`, async (req, res) => {
    try {
        const { email, otp} = req.body;

        const user = await User.findOne({ email: email });
        if (!user) {
            return res.status(400).json({ success: false, message: "User not found"});
        }

        const isCodeValid = user.otp === otp;
        const isNotExpired = user.otpExpires > Date.now();

        if (isCodeValid && isNotExpired) {
            user.isVerified = true;
            user.otp = null;
            user.otpExpires = null;
            await user.save();
            return res.status(200).json({ success: true, message: "OTP verified successfully!"});
        } else if (!isCodeValid) {
            return res.status(400).json({ success: false, message: "Invalid OTP"});
        } else {
            return res.status(400).json({ success: false, message: "OTP expired"});
        }
    } catch (err) {
        console.log("Error in verifyEmail", err);
        res.status(500).json({ success: false, message: "Error in verifying email"});
    }
});

router.post(`/signin`, async (req, res) => {
    const { email, password } = req.body;

    try {
        const existingUser = await User.findOne({ email: email });
        console.log("Found user:", existingUser);

        if (!existingUser) {
            console.log("User not found");
            return res.status(404).json({ error: true, msg: "User not found!" });
        }

        if (existingUser.isVerified === false) {
            console.log("User not verified");
            return res.status(403).json({
                error: true,
                isVerify: false,
                msg: "Your account is not active yet. Please verify your account first or sign up with a new user."
            });
        }

        const matchPassword = await bcrypt.compare(password, existingUser.password);
        console.log("Password match:", matchPassword);

        if (!matchPassword) {
            return res.status(400).json({ error: true, msg: "Password does not match" });
        }


        const token = jwt.sign(
            { email: existingUser.email, id: existingUser._id },
            process.env.JSON_WEB_TOKEN_SECRET_KEY
        );

        return res.status(200).json({
            error: false,
            user: {
                id: existingUser._id,
                name: existingUser.name,
                email: existingUser.email
            },
            token: token,
            msg: "User authenticated"
        });
    } catch (error) {
        console.error("Signin error:", error);
        return res.status(500).json({ error: true, msg: "Something went wrong" });
    }
});


router.post(`/authWithGoogle`, async (req, res) => {
    const {name, phone, email, password, images, isAdmin} = req.body;

    try {
        const existingUser = await User.findOne({ email: email });

        if(!existingUser){
            const result = await User.create({
                name:name,
                phone:phone,
                email:email,
                password:password,
                images:images,
                isAdmin:isAdmin
            });

            const token = jwt.sign({email:result.email, id:result._id}, process.env.JSON_WEB_TOKEN_SECRET_KEY);

            return res.status(200).send({
                user:result,
                token:token,
                msg:"User Login Successfully!"
            })
        }
        else{
            const existingUser = await User.findOne({ email: email});
            const token = jwt.sign({email:existingUser.email, id:existingUser._id}, 
            process.env.JSON_WEB_TOKEN_SECRET_KEY);

            return res.status(200).send({
                user:existingUser,
                token:token,
                msg:"User Login Successfully!"
            })
        }
    } catch(error){
        console.log(error)
    }
})

router.put(`/changePassword/:id`, async (req, res) => {
    try {
        const { name, phone, email, password, newPass, images } = req.body;

        const existingUser = await User.findOne({ email: email });

        if (!existingUser) { // ❗ Fixed condition: should be `!existingUser`
            return res.status(400).json({ error: true, msg: "User not found!" });
        }

        const matchPassword = await bcrypt.compare(password, existingUser.password);

        if (!matchPassword) {
            return res.status(400).json({ error: true, msg: "Current password is wrong" });
        }

        let newPassword = newPass ? bcrypt.hashSync(newPass, 10) : existingUser.password;

        const user = await User.findByIdAndUpdate(
            req.params.id, // ❗ `findByIdAndDelete` was incorrect
            { name, phone, email, password: newPassword, images },
            { new: true }
        );

        if (!user) {
            return res.status(400).send("The user cannot be updated!");
        }

        return res.status(200).json(user); // ✅ Ensuring response is sent only once
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: true, msg: "Internal Server Error" });
    }
});




router.get(`/`, async (req, res) =>{
    const userList = await User.find();

    if(!userList) {
        res.status(500).json({success: false})
    }
    res.send(userList);
})


router.get('/:id', async(req,res)=>{
    const user = await User.findById(req.params.id);

    if(!user) {
       return res.status(500).json({message: 'The user with the given ID was not found.'})
    }
    return res.status(200).send(user);
})


router.delete('/:id', (req, res)=>{
    User.findByIdAndDelete(req.params.id).then(user =>{
        if(user) {
            return res.status(200).json({error:true, message: 'the user is deleted!'})
        } else {
            return res.status(404).json({error:true, message: "user not found!"})
        }
    }).catch(err=>{
        return res.status(500).json({success: false, error: err})
    })
})



// GET Total Users
router.get('/get/count', async (req, res) => {
    try {
        const count = await User.countDocuments();
        res.status(200).json({ success: true, userCount: count });
    } catch (err) {
        console.error("Error fetching total users:", err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const { name, phone, email, password, images } = req.body;

        const userExist = await User.findById(req.params.id);
        if (!userExist) {
            return res.status(404).json({ error: true, msg: 'User not found' });
        }

        let newPassword = userExist.password;
        if (password) {
            newPassword = bcrypt.hashSync(password, 10);
        }

        const user = await User.findByIdAndUpdate(
            req.params.id,
            {
                name,
                phone,
                email,
                password: newPassword,
                images: images || userExist.images, // Preserve existing images if not provided
            },
            { new: true }
        );

        if (!user) {
            return res.status(400).json({ error: true, msg: 'The user cannot be updated' });
        }

        return res.status(200).json(user);
    } catch (error) {
        console.error('Update error:', error);
        return res.status(500).json({ error: true, msg: 'Update failed', details: error.message });
    }
});


router.delete('/deleteImage', async (req, res) => {
    try {
        const { categoryId, imageId } = req.body; // Ensure imageId is sent

        console.log("Received delete request for:", { categoryId, imageId });

        // Find the category
        const category = await Category.findById(categoryId);
        if (!category) {
            return res.status(404).json({ success: false, message: "Category not found!" });
        }

        // Find the image URL that needs to be deleted
        const imageUrl = category.images.find(img => img.includes(imageId));
        if (!imageUrl) {
            return res.status(404).json({ success: false, message: "Image not found in this category!" });
        }

        console.log("Found image URL:", imageUrl);

        // Extract correct public_id
        const getPublicIdFromUrl = (imageUrl) => {
            const parts = imageUrl.split('/');
            const index = parts.findIndex(part => part === "upload") + 1;
            return parts.slice(index).join('/').split('.')[0]; // Extracts full path
        };

        const publicId = getPublicIdFromUrl(imageUrl);
        console.log("Extracted Cloudinary public ID:", publicId);

        // Delete image from Cloudinary
        cloudinary.uploader.destroy(publicId).then(async (result) => {
            if (result.result !== "ok") {
                return res.status(500).json({ success: false, message: "Cloudinary deletion failed" });
            }

            category.images = category.images.filter(img => img !== imageUrl);
            await category.save();

            return res.status(200).json({
                success: true,
                message: "Image deleted successfully!",
                updatedCategory: category
            });
        })
        .catch((error) => {
            console.error("Cloudinary delete error:", error);
            return res.status(500).json({ success: false, message: "Failed to delete from Cloudinary" });
        });


    } catch (error) {
        console.error("Error deleting image:", error);
        return res.status(500).json({ success: false, message: "Internal server error while deleting image" });
    }
});


router.post(`/forgotPassword`, async (req, res) => {
    const { email } = req.body;

    try {

        const verifyCode = Math.floor(100000 + Math.random() * 900000).toString();

        const existingUser = await User.findOne({ email: email });

        if (!existingUser) {
            return res.json({ status: "FAILED", msg: "User not exist with this email!" });
        }
        
        if(existingUser) {
            existingUser.otp = verifyCode;
            existingUser.otpExpires = Date.now() + 600000;
            await existingUser.save();
        } 

        const resp = sendEmailFun(email, "Verify Email", "", "Your OTP is "+verifyCode);

        return res.status(200).json({
            success:true,
            status:"SUCCESS",
            message: "OTP Send",
        });

    } catch (error) {
        console.log(error);
        res.json({status:'FAILED', msg:"something went wrong"});
        return;
    }
})


router.post(`/forgotPassword/changePassword`, async (req, res) => {
    const { email, newpass } = req.body;

    try {

        const existingUser = await User.findOne({ email: email });

        
        if(existingUser) {
            const hashPassword = await bcrypt.hash(newpass, 10);
            existingUser.password = hashPassword;
            await existingUser.save();
        }

        return res.status(200).json({
            success:true,
            status: "SUCCESS",
            message: "Password changed successfully.",
        });

    } catch (error) {
        console.log(error);
        res.json({status:'FAILED', msg:"something went wrong"});
        return;
    }
})



module.exports = router;