export default (req,res)=>res.status(200).json({
  ok:true,
  env:{
    GITHUB_REPO:process.env.GITHUB_REPO,
    GITHUB_BRANCH:process.env.GITHUB_BRANCH,
    CODES_PATH:process.env.CODES_PATH,
    HAS_TOKEN:!!process.env.GITHUB_TOKEN
  }
});
