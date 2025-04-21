const { Category } = require('../models/category');
const { ImageUpload } = require('../models/imageUpload');
const express = require('express');
const router = express.Router();
const multer  = require('multer');
const slugify = require("slugify");
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



const createCategories = (categories, parentId=null) => {

    const categoryList = [];

    let category;

    if (parentId == null) {
        category = categories.filter((cat) => cat.parentId == undefined);
    } else {
        category = categories.filter((cat) => cat.parentId == parentId);
    }

    for (let cat of category) {

        categoryList.push({
            _id: cat._id,
            id: cat._id,
            name: cat.name,
            images: cat.images,
            color: cat.color,
            slug: cat.slug,
            children: createCategories(categories, cat._id)
        });
    }

    return categoryList;
};

router.get("/", async (req, res) => {
    try {

        const categoryList = await Category.find();

        if (!categoryList) {
            res.status(500).json({ success: false});
        }

        if (categoryList) {
            const categoryData = createCategories(categoryList);

            return res.status(200).json({
                categoryList: categoryData
            });
        }
    } catch (error) {
        console.log(error);
    }
   
});


router.get(`/get/count`, async(req, res) => {
    const categoryCount = await Category.countDocuments({parentId: undefined});

    if(!categoryCount) {
        res.status(500).json({success: false})
    }
    else{
        res.send({
            categoryCount: categoryCount,
        });
    }
});

router.get(`/subCat/get/count`, async(req, res) => {
    const category = await Category.find();

    if(!category) {
        res.status(500).json({success: false})
    }
    else{
        const subCatList = [];

        for(let cat of category) {
            if(cat.parentId!==undefined){
                subCatList.push(cat);
            }
        }

        res.send({
            categoryCount: subCatList.length,
        });
    }
});


router.get("/:id", async (req, res)=> {
    categoryEditId = req.params.id;

    const category = await Category.findById(req.params.id);

    if(!category) {
        res.status(500).json({message: 'The category with the given ID was not found.' })
    }
    return res.status(200).send(category);
});


router.post(`/create`, async (req, res) => {
    let catObj = {};

    if (imagesArr.length > 0) {
        catObj = {
            name: req.body.name,
            images: imagesArr,
            color: req.body.color,
            slug: req.body.name,
        };
    } else {
        catObj = {
            name: req.body.name,
            slug: req.body.name,
        };
    }

    if (req.body.parentId) {
        catObj.parentId = req.body.parentId;
    }

    let category = new Category(catObj);

    if (!category) {
        res.status(500).json({
            error: err,
            success: false,
        });
    }

    category = await category.save();

    imagesArr = [];

    res.status(201).json(category);
});

router.delete('/deleteImage', async (req, res) => {
    const imgUrl = req.query.img;

    const urlArr = imgUrl.split("/");
    const image = urlArr[urlArr.length - 1];

    const imageName = image.split(".")[0];

    const response = await cloudinary.uploader.destroy(
        imageName,
        (error, result) => {

        }
    );
    
    if (response) {
        res.status(200).send(response);
    }
});


router.delete("/:id", async (req, res) => {
    const category = await Category.findById(req.params.id);
    const images = category.images;

    for (img of images) {
        const imgUrl = img;
        const urlArr = imgUrl.split("/");
        const image = urlArr[urlArr.length -1];

        const imageName = image.split(".")[0];

        if (imageName) {
            cloudinary.uploader.destroy(imageName, (error, result) => {

            });
        }
    }

    const deletedCat = await Category.findByIdAndDelete(req.params.id);

    if(!deletedCat) {
        res.status(404).json({
            message: "Category not found!",
            success: false,
        });
    }

    res.status(200).json({
        success: true,
        message: "Category Deleted!",
    });
});



router.put("/:id", async (req, res) => {

    const category = await Category.findByIdAndUpdate(
        req.params.id,
        {
            name: req.body.name,
            images: req.body.images,
            color: req.body.color,
        },
        { new: true }
    );

    if(!category) {
        return res.status(500).json({
            message: "Category cannot be updated!",
            success: false,
        });
    }

    imagesArr = [];

    res.send(category);
});


module.exports = router;
