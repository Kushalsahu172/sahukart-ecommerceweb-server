const { Orders } = require('../models/orders');
const express = require('express');
const router = express.Router();


router.get(`/`, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const perPage = 6;

        const userId = req.query.userId;

        // Build filter
        const filter = userId ? { userid: userId } : {};

        const totalPosts = await Orders.countDocuments(filter);
        const totalPages = Math.ceil(totalPosts / perPage);

        if (page > totalPages && totalPages > 0) {
            return res.status(404).json({ message: "No data found!" });
        }

        const ordersList = await Orders.find(filter)
            .skip((page - 1) * perPage)
            .limit(perPage)
            .exec();

        if (!ordersList) {
            return res.status(500).json({ success: false });
        }

        return res.status(200).json({
            ordersList,
            totalPages,
            page
        });
    } catch (error) {
        console.error("Error fetching orders:", error);
        res.status(500).json({ success: false });
    }
});


router.get(`/:id`, async (req, res)=> {

    const order = await Orders.findById(req.params.id);

    if(!order) {
        res.status(500).json({message: 'The order with the given ID was not found.' })
    }
    return res.status(200).send(order);
});

router.post(`/create`, async (req, res) => {

    let order = new Orders({
        name:req.body.name,
        phoneNumber:req.body.phoneNumber,
        address:req.body.address,
        pincode:req.body.pincode,
        amount:req.body.amount,
        paymentId:req.body.paymentId,
        email:req.body.email,
        userid:req.body.userid,
        products:req.body.products
    });


    if (!order) {
        res.status(500).json({
            error: err,
            success: false
        });
    }


    order = await order.save();

    res.status(201).json(order);

});



router.delete(`/:id`, async (req, res) => {

    const deletedOrder = await Orders.findByIdAndDelete(req.params.id);

    if(!deletedOrder) {
        res.status(404).json({
            message: 'Order not found!',
            success: false
        })
    }

    res.status(200).json({
        success: true,
        message: 'Order Deleted!'
    })
});

router.get(`/get/count`, async (req, res) => {
    try {
        const ordersCount = await Orders.countDocuments();
        if (!ordersCount) {
            return res.status(500).json({ success: false, message: "Failed to count orders." });
        }
        res.status(200).json({ ordersCount });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.put(`/:id`, async (req, res) => {

    const order = await Orders.findByIdAndUpdate(
        req.params.id,
        {
            name:req.body.name,
            phoneNumber:req.body.phoneNumber,
            address:req.body.address,
            pincode:req.body.pincode,
            amount:req.body.amount,
            paymentId:req.body.paymentId,
            email:req.body.email,
            userid:req.body.userid,
            products:req.body.products,
            status:req.body.status
        },
        { new: true}
    )

    if (!order) {
        return res.status(500).json({
            message: 'Order cannot be updated!',
            success: false
        })
    }

    res.send(order);
});

// routes/orders.js (example)
router.get('/sales-summary', async (req, res) => {
    try {
        const orders = await Orders.find({ isPaid: true });

        const totalSales = orders.reduce((sum, order) => sum + order.totalAmount, 0);

        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

        const lastMonthSales = orders
            .filter(order => new Date(order.createdAt) > oneMonthAgo)
            .reduce((sum, order) => sum + order.totalAmount, 0);

        // Category-wise sales breakdown (optional for pie chart)
        const categorySales = {};

        orders.forEach(order => {
            order.items.forEach(item => {
                const cat = item.category || 'Others';
                categorySales[cat] = (categorySales[cat] || 0) + item.price * item.quantity;
            });
        });

        const pieChartData = [['Category', 'Sales']];
        for (const cat in categorySales) {
            pieChartData.push([cat, categorySales[cat]]);
        }

        res.json({ totalSales, lastMonthSales, pieChartData });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error fetching sales summary' });
    }
});



module.exports = router;