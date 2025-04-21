const { Category } = require('../models/category.js');
const {Product} = require('../models/products.js');
const {ImageUpload} = require('../models/imageUpload.js');
const express = require('express');
const router = express.Router();
const multer  = require('multer');
const fs = require("fs");
const { RecentlyViewed } = require('../models/RecentlyViewed.js');
const streamifier = require('streamifier');


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

router.get(`/`, async (req, res) =>{

    const page = parseInt(req.query.page) || 1;
    const perPage = parseInt(req.query.perPage);
    const totalPosts = await Product.countDocuments();
    const totalPages = Math.ceil(totalPosts / perPage);

    if (page > totalPages) {
        return res.status(404).json({ message: "Page not found" })
    }

    let productList=[];

    if (req.query.minPrice !== undefined && req.query.maxPrice !== undefined) {

        if(req.query.subCatId !== undefined && req.query.subCatId !== null && req.query.subCatId !== "") {

            productList = await Product.find({subCatId: req.query.subCatId}).populate("category");

        }

        if(req.query.catId !== undefined && req.query.catId !== null && req.query.catId !== "") {

            productList = await Product.find({catId: req.query.catId}).populate("category");

        }
        
        const filteredProducts = productList.filter(product => {
            if (req.query.minPrice && product.price < parseInt(+req.query.minPrice)) {
                return false;
            }
            if (req.query.maxPrice && product.price > parseInt(+req.query.maxPrice)) {
                return false;
            }
            return true;
        });
        
        if(!productList) {
            res.status(500).json({success: false})
        }
        return res.status(200).json({
            "products": filteredProducts,
            "totalPages": totalPages,
            "page": page
        });

    } 
    else if (req.query.page !== undefined && req.query.perPage !== undefined) {
        productList = await Product.find().populate("category").skip((page - 1) * perPage)
            .limit(perPage)
            .exec();
        
        if (!productList) {
            res.status(500).json({ success: false })
        }
        return res.status(200).json({
            "products": productList,
            "totalPages": totalPages,
            "page": page
        });
    }
    
    else {
        productList = await Product.find(req.query).populate("category");
        if (!productList) {
            res.status(500).json({ success: false })
        }
        return res.status(200).json({
            "products" : productList,
            "totalPages": totalPages,
            "page": page
        });
    }

});

router.get(`/get/count`, async (req, res) => {
    try {
        const productsCount = await Product.countDocuments();
        if (!productsCount) {
            return res.status(500).json({ success: false, message: "Failed to count products." });
        }
        res.status(200).json({ productsCount });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.get('/subCat/get/count', async (req, res) => {
    const subCatCount = await Product.countDocuments({ subCatId: { $exists: true, $ne: null } });

    if (!subCatCount) {
        res.status(500).json({ success: false });
    }

    res.status(200).json({ subCatCount: subCatCount });
});



// router.get(`/subCat/get/count`, async(req, res) => {
//     const productsCount = await Product.countDocuments({parentId: !undefined});

//     if(!productsCount) {
//         res.status(500).json({success: false})
//     }
//     res.send({
//         productsCount: productsCount
//     });
// })

router.get(`/featured`, async (req, res) =>{
    const productList = await Product.find({isFeatured:true});
    if(!productList) {
        res.status(500).json({success: false})
    }

    return res.status(200).json(productList);
});


// router.get(`/recentlyViewed`, async (req, res) => {
//     let productList = [];
//     productList = await Product.find(req.query).populate("category");

//         if (!productList) {
//             res.status(500).json({ success: false })
//         }

//         return res.status(200).json(productList);
// })


// router.post(`/recentlyViewed`, async (req, res) => {

//     let findProduct = await RecentlyViewed.find({prodId:req.body.prodId});

//     var product;

//     if(findProduct.length===0){
//         product = new RecentlyViewed({
//             prodId:req.body.id,
//             name: req.body.name,
//             subCat: req.body.subCat,
//             description: req.body.description,
//             images: req.body.images,
//             brand: req.body.brand,
//             price: req.body.price,
//             oldPrice: req.body.oldPrice,
//             catName: req.body.catName,
//             subCatId: req.body.subCatId,
//             category: req.body.category,
//             countInStock: req.body.countInStock,
//             rating: req.body.rating,
//             isFeatured: req.body.isFeatured,
//             discount: req.body.discount,
//             size: req.body.size,
//             productWeight: req.body.productWeight,
//         });

//         product = await product.save();

//         if (!product) {
//             res.status(500).json({
//                 error: err,
//                 success: false
//             });
//         }

//         res.status(201).json(product);
//     }

    
// });


router.post(`/create`, async (req, res) => {
        const category = await Category.findById(req.body.category);
        if (!category) {
            return res.status(404).send("Invalid Category!" ); // Return JSON
        }

        const images_Array = [];
        const uploadedImages = await ImageUpload.find();

        const images_Arr = uploadedImages?.map((item) => {
            item.images?.map((image) => {
                images_Array.push(image);
                console.log(image);
            })
        })

        let product = new Product({
            name: req.body.name,
            subCat:req.body.subCat,
            description: req.body.description,
            images: images_Array,
            brand: req.body.brand,
            price: req.body.price,
            oldPrice: req.body.oldPrice,
            catId: req.body.catId,
            catName: req.body.catName,
            subCatId: req.body.subCatId,
            category: req.body.category,
            countInStock: req.body.countInStock,
            rating: req.body.rating,
            isFeatured: req.body.isFeatured,
            discount: req.body.discount,
            size: req.body.size,
            productWeight: req.body.productWeight,
        });

        product = await product.save();
        if (!product) {
            return res.status(500).json({
                error:err,
                success: false
            });
        }

        imagesArr = [];

        res.status(201).json(product);
});



router.get('/:id', async(req, res) => {
    productEditId = req.params.id;

    const product = await Product.findById(req.params.id).populate("category");

    if(!product) {
        res.status(500).json({ message: 'The product with the given ID was not found.'})
    }
    return res.status(200).send(product);
})


router.delete('/deleteImage', async (req, res) => {
    const imgUrl = req.query.img;

    //console.log(imgUrl)

    const urlArr = imgUrl.split('/');
    const image = urlArr[urlArr.length -1];

    const imageName = image.split('.')[0];


    const response = await cloudinary.uploader.destroy(imageName, (error, result) => {

    })

    if (response) {
        res.status(200).send(response);
    }
});


router.delete("/:id", async (req, res) => {

    const product = await Product.findById(req.params.id);
    const images = product.images;

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

    const deletedProduct = await Product.findByIdAndDelete(req.params.id);

    if(!deletedProduct) {
        res.status(404).json({
            message: "Product not found!",
            success: false,
        });
    }

    res.status(200).json({
        success: true,
        message: "Product Deleted!",
    });
});



router.put('/:id', async(req,res)=>{

    const product = await Product.findByIdAndUpdate(
        req.params.id,
        {
            name: req.body.name,
            subCat:req.body.subCat,
            description: req.body.description,
            images: req.body.images,
            brand: req.body.brand,
            price: req.body.price,
            oldPrice: req.body.oldPrice,
            catId: req.body.catId,
            subCatId: req.body.subCatId,
            catName: req.body.catName,
            category: req.body.category,
            countInStock: req.body.countInStock,
            rating: req.body.rating,
            numReviews: req.body.numReviews,
            isFeatured: req.body.isFeatured,
            discount: req.body.discount,
            size: req.body.size,
            productWeight: req.body.productWeight,
        },
        {new:true}
    );

    if(!product){
        res.status(404).json({
            message:'the product can not be updated!',
            status:false
        })
    }

    imagesArr = [];

    res.status(200).json({
        message:'the product is updated!',
        status:true
    });
})

module.exports = router;
