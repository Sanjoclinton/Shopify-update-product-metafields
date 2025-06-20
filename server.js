const express = require("express");
const cors = require("cors");
const axios = require("axios");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

const SHOPIFY_STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Product Metafield API is live");
});

app.post("/update-product-metafield", async (req, res) => {
  let { productId, yearRange } = req.body;
  if (!productId || !yearRange) {
    return res.status(400).json({
      success: false,
      message: "Missing productId or yearRange",
    });
  }

  // 🧼 Clean GID if needed
  if (productId.startsWith("gid://shopify/Product/")) {
    productId = productId.replace("gid://shopify/Product/", "");
  }

  try {
    const currentYear = new Date().getFullYear();
    let [start, end] = yearRange.toLowerCase().replace(/\s/g, "").split("-");
    if (end === "current") end = currentYear.toString();

    const startYear = parseInt(start, 10);
    const endYear = parseInt(end, 10);

    if (isNaN(startYear) || isNaN(endYear) || startYear > endYear) {
      return res.status(400).json({
        success: false,
        message: "Invalid year range format",
      });
    }

    const yearList = Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i);
    const yearString = yearList.join(",");

    const productGID = `gid://shopify/Product/${productId}`;

    const query = `
      mutation {
        metafieldsSet(metafields: [
          {
            namespace: "custom",
            key: "vehicle_year_range_list",
            type: "single_line_text_field",
            value: "${yearString}",
            ownerId: "${productGID}"
          }
        ]) {
          metafields {
            key
            namespace
            value
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const response = await axios.post(
      `https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-01/graphql.json`,
      { query },
      {
        headers: {
          "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
          "Content-Type": "application/json",
        },
      }
    );

    const data = response.data;
    const errors = data?.data?.metafieldsSet?.userErrors || [];

    if (errors.length > 0) {
      return res.status(500).json({
        success: false,
        message: "Failed to update metafield",
        details: errors,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Metafield updated successfully",
      years: yearList,
    });
  } catch (err) {
    console.error("Error:", err.response?.data || err.message);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
