// create a menu entry when the document is opened
function onOpen(e) {
  DocumentApp.getUi().createAddonMenu()
      .addItem('Start', 'showSidebar')
      .addToUi();
}

// run when the add-on is installed
function onInstall(e) {
  onOpen(e);
}

// open the sidebar
function showSidebar() {
  const template = HtmlService.createTemplateFromFile('landing');
  const ui = template.evaluate().setTitle('MateriALL');
  DocumentApp.getUi().showSidebar(ui);
}

// include file
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename)
      .getContent();
}

// setting this for storing global variables
var userProperties = PropertiesService.getDocumentProperties();

// makes the worksheet from answer sheet
function makeWorkSheet() {
  var currDoc = DocumentApp.getActiveDocument();
  var currID = currDoc.getId();
  var file = DriveApp.getFileById(currID);
  var source_folder = DriveApp.getFolderById(currID)
  var newFile = file.makeCopy('WorkSheet ' + file.getName());
  var newFileId = newFile.getId();
  var newDocBody = DocumentApp.openById(newFileId).getBody();
  // newDocBody.replaceText("/Answer:(.*)/gm", "");
  newDocBody.replaceText("Answer:.*$", "Answer:\n");
}

// ===== functions for all pages ===========================================

// get new page content to generate
function newPage(page) {
  return HtmlService.createTemplateFromFile(page).evaluate().getContent();
}


// ===== functions for landing.html ========================================

function saveSlideID(url) {
  // delete previous stored slide first
  userProperties.deleteAllProperties();
  const myRe = /presentation\/d\/([a-zA-Z0-9-_]+)/;
  var presentationId = myRe.exec(url)[1];
  userProperties.setProperty('PRESENTATION_ID', presentationId);
  return true;
}

// ===== functions for loading.html ========================================

// get slide with id and save slide
function saveAndGetSlide() {

  // get slide id from url
  var presentationId = userProperties.getProperty('PRESENTATION_ID');
  var presentation = Slides.Presentations.get(presentationId);

  // save slide content json
  var slides = presentation.slides;
  userProperties.setProperty('SLIDES', JSON.stringify(slides));

  // get and save slide page id for each page
  // var presentationPageIds = [];
  var thumbnail_per_page = [];
  for (let i = 0; i< slides.length; i++) {
    var currPageId = slides[i].objectId;
    var thumbnailJson = Slides.Presentations.Pages.getThumbnail(presentationId, currPageId, {"thumbnailProperties.thumbnailSize": "SMALL"});
    // thumbnail_per_page.push(thumbnailJson.contentUrl);
    // presentationPageIds.push(slides[i].objectId);
    userProperties.setProperty(`${i}_thumbnail`, thumbnailJson.contentUrl);
  }
  // userProperties.setProperty('THUMBNAILS', JSON.stringify(thumbnail_per_page));
  // userProperties.setProperty('PAGE_IDS', JSON.stringify(presentationPageIds));

  // save slide length
  userProperties.setProperty('TOTAL_PAGES', slides.length);
  // Logger.log(userProperties.getProperty('TEXTS_ELEMS'))
  // Logger.log(userProperties.getProperty('IMGS_ELEMS'))

  // texts_per_page = []
  // imgs_per_page = []

  slides.forEach((page, index) => {
    var currPageElements = page.pageElements;
    var currPageTexts = [];
    var currPageUrls = [];
    currPageElements.forEach((element) => {
      if (element.shape && element.shape.shapeType === "TEXT_BOX") {
        var currTextElements = element.shape.text.textElements;
        if (currTextElements) {
          currTextElements.forEach((text) => {
          if (text.textRun) {
            currPageTexts.push(text.textRun.content)
          }
        })
        }
      }
      else if (element.image) {
        currPageUrls.push(element.image.contentUrl);
      }
      userProperties.setProperty(`${index}_text`, JSON.stringify(currPageTexts));
      userProperties.setProperty(`${index}_img`, JSON.stringify(currPageUrls));      
    })
    // texts_per_page.push(currPageTexts)
    // imgs_per_page.push(currPageUrls)
  })
  // userProperties.setProperty('TEXTS_ELEMS', JSON.stringify(texts_per_page));
  // userProperties.setProperty('IMGS_ELEMS', JSON.stringify(imgs_per_page));

  // userProperties.setProperty(`${presentationId}_${index}_text`, JSON.stringify(currPageTexts));
  // userProperties.setProperty(`${presentationId}_${index}_img`, JSON.stringify(currPageUrls));
  return slides.length; 
}

// ===== functions for main.html ========================================

function getPageTextAndImg(slidePage) {
  var pageDetails = [];
  var currPage = slidePage - 1;
  var totalPages = getTotalPages();
  if (currPage < 0) {
    currPage = totalPages - 1;
  }
  if (currPage >= totalPages) {
    currPage = 0;
  }
  var thumbnail = userProperties.getProperty(`${currPage}_thumbnail`);
  var text = JSON.parse(userProperties.getProperty(`${currPage}_text`));
  var img = JSON.parse(userProperties.getProperty(`${currPage}_img`));
  pageDetails.push(thumbnail, text, img, currPage + 1);
  return pageDetails;
}

function getTotalPages() {
  var totalPages = userProperties.getProperty('TOTAL_PAGES');
  return totalPages;
}

function saveClickedElements(checkedText, checkedImgUrl) {
  // userProperties.setProperty('CHECKED_TEXT', JSON.stringify(checkedText));
  userProperties.setProperty('CHECKED_TEXT', checkedText);
  userProperties.setProperty('CHECKED_IMG', JSON.stringify(checkedImgUrl));
}


// ===== functions for modal.html ========================================

function showDialog() {
  // userProperties.setProperty('CURR_PAGE', slidePage - 1);
  // currPage = slidePage - 1; // adjusting to computer page index

  var html = HtmlService.createTemplateFromFile('modal').evaluate()
      .setWidth(800)
      .setHeight(700);

  DocumentApp.getUi().showModalDialog(html, 'MateriALL Question Editor');
}

function getCheckedData() {
  Logger.log(userProperties.getProperty('CHECKED_TEXT'))
  var checkedData = userProperties.getProperty('CHECKED_TEXT');
  var dataText = {"text": checkedData}
  var options = {
    'method' : 'post',
    'contentType': 'application/json',
    'payload' : JSON.stringify(dataText)
  };
  var response = UrlFetchApp.fetch("https://materiall.herokuapp.com/autogenerate", options);
  var result = JSON.parse(response.getContentText());
  Logger.log(result)
  return result

  // var res = '{"blank":{"answer": "the interdisciplinary, scientific study","beginning": "Cognitive science is ","blank_sentence": "Cognitive science is _______________________________________ of  the mind","end": " of the mind"},"false_sentences": ["Cognitive science differ the interdisciplinary, scientific study of the mind","Cognitive science isnt the interdisciplinary, scientific study of the mind","Cognitive science is not the interdisciplinary, scientific study of the mind","Cognitive science is the interdisciplinary, unscientific study of the mind","Cognitive science is the   interdisciplinary, scientific study of the forget"],"mc_options": {"Cognitive": ["physiological","maturational","sensory","neural"],"interdisciplinary,": [],"is": ["involves","becomes","was", "seems"],"mind": ["senses","thinking","forever","thoughts"],"of": [],"science": ["math","humanities","mathematics","scientific"],"scientific": ["empirical","research","scientists","scientist"], "study": ["researchers","research","surveys","studied"],"the": ["however","another","one","entire"]},"text": "Cognitive science is the interdisciplinary, scientific study of the mind"}'
  // return JSON.parse(res);

  // return [userProperties.getProperty('CHECKED_TEXT'), JSON.parse(userProperties.getProperty('CHECKED_IMG'))]
  // return [JSON.parse(userProperties.getProperty('CHECKED_TEXT')), JSON.parse(userProperties.getProperty('CHECKED_IMG'))]
}

function getThumbnailUrl() {
  var presentationId = userProperties.getProperty('PRESENTATION_ID');
  var currPage = parseInt(userProperties.getProperty('CURR_PAGE'), 10);
  var presentationPageIds = JSON.parse(userProperties.getProperty('PAGE_IDS'));
  // Logger.log(presentationId)
  // Logger.log(currPage)
  // Logger.log(presentationPageIds)
  // Logger.log(presentationPageIds[currPage])
  var thumbnailJson = Slides.Presentations.Pages.getThumbnail(presentationId, presentationPageIds[currPage], {"thumbnailProperties.thumbnailSize": "SMALL"});
  return thumbnailJson.contentUrl;
}

function insertToDoc(value) {
  var doc = DocumentApp.getActiveDocument();
  var body = doc.getBody();
  body.appendParagraph(value);

}

