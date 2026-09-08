module.exports = async function handler(req,res){
  if(req.method!=='GET')return res.status(405).json({ok:false});
  res.setHeader('Cache-Control','public, max-age=0, s-maxage=300');
  return res.status(200).json({
    gtmContainerId:process.env.GTM_CONTAINER_ID||null,
    ga4MeasurementId:process.env.GA4_MEASUREMENT_ID||null,
    metaPixelId:process.env.META_PIXEL_ID||null
  });
};
