const { HomeBanner } = require('../models/homeBanner');
const { ImageUpload } = require('../models/imageUpload');
const express = require('express');
const router = express.Router();
const multer  = require('multer');
const streamifier = require('streamifier');

const fs = require("fs");

const cloudinary = require('cloudinary').v2;

cloudinary.config({
    cloud_name: process.env.cloudinary_Config_Cloud_Name,
    api_key: process.env.cloudinary_Config_api_key,
    api_secret: process.env.cloudinary_Config_api_secret,
    secure: true
});

var imagesArr=[];

// memory storage instead of disk
const storage = multer.memoryStorage();
const upload = multer({ storage });


router.post('/upload', upload.array('images'), async (req, res) => {
    imagesArr = [];

    try {
        for (const file of req.files) {
            const buffer = file.buffer;

            const uploadFromBuffer = () => {
                return new Promise((resolve, reject) => {
                    const stream = cloudinary.uploader.upload_stream(
                        { folder: 'categories' }, // Optional: you can change the folder
                        (error, result) => {
                            if (error) return reject(error);
                            return resolve(result);
                        }
                    );
                    streamifier.createReadStream(buffer).pipe(stream);
                });
            };

            const result = await uploadFromBuffer();
            imagesArr.push(result.secure_url);
        }

        let imagesUploaded = new ImageUpload({
            images: imagesArr,
        });

        imagesUploaded = await imagesUploaded.save();
        return res.status(200).json(imagesArr);
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            message: "Something went wrong while uploading to Cloudinary.",
            error: error.message,
        });
    }
});


router.get(`/`, async (req, res) => {
    try{
        
        const bannerImagesList = await HomeBanner.find();

        if (!bannerImagesList) {
            res.status(500).json({ success: false})
        }

        return res.status(200).json(bannerImagesList);
    }catch(error){
        res.status(500).json({ success: false})
    }
   
});

router.get(`/:id`, async (req, res)=> {
    slideEditId=req.params.id;

    const slide = await HomeBanner.findById(req.params.id);

    if(!slide) {
        res.status(500).json({message: 'The slide with the given ID was not found.' })
    }
    return res.status(200).send(slide);
});

router.post(`/create`, async (req, res) => {

    let newEntry = new HomeBanner({
        images: imagesArr
    });


    if (!newEntry) {
        res.status(500).json({
            error: err,
            success: false
        });
    }


    newEntry = await newEntry.save();

    imagesArr = [];

    res.status(201).json(newEntry);

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
        cloudinary.uploader.destroy(publicId, async function (error, result) {
            if (error) {
                console.error("Cloudinary delete error:", error);
                return res.status(500).json({ success: false, message: "Failed to delete from Cloudinary" });
            }
            console.log("Cloudinary delete result:", result);

            if (result.result !== 'ok') {
                return res.status(500).json({ success: false, message: "Cloudinary deletion failed" });
            }

            // Remove image from MongoDB category
            category.images = category.images.filter(img => img !== imageUrl);
            await category.save();

            return res.status(200).json({
                success: true,
                message: "Image deleted successfully!",
                updatedCategory: category
            });
        });

    } catch (error) {
        console.error("Error deleting image:", error);
        return res.status(500).json({ success: false, message: "Internal server error while deleting image" });
    }
});




router.delete(`/:id`, async (req, res) => {

    const item = await HomeBanner.findById(req.params.id);
    const images = item.images;

    for(img of images){
        const imgUrl = img;
        const urlArr = imgUrl.split('/');
        const image = urlArr[urlArr.length-1];

        const imageName = image.split('.')[0];

        cloudinary.uploader.destroy(imageName, (error,result)=>{
            //console.log(error, result);
        })
    }

    const deletedItem = await HomeBanner.findByIdAndDelete(req.params.id);

    if(!deletedItem) {
        res.status(404).json({
            message: 'Slide not found!',
            success: false
        })
    }

    res.status(200).json({
        success: true,
        message: 'Category Deleted!'
    })
});



router.put(`/:id`, async (req, res) => {

    const slideItem = await HomeBanner.findByIdAndUpdate(
        req.params.id,
        {
            images: req.body.images,
        },
        { new: true}
    )

    if(!slideItem) {
        return res.status(500).json({
            message: 'Item cannot be updated!',
            success: false
        })
    }

    imagesArr = [];

    res.send(slideItem);
});


module.exports = router;
