// creates a menu entry when the document is opened
function onOpen(e) {
  DocumentApp.getUi().createAddonMenu()
      .addItem('Create Questions from Slides', 'showSidebar')
      .addItem('Convert Answer Key to Worksheet', 'makeWorkSheet')
      .addToUi();
}

// runs when the add-on is installed
function onInstall(e) {
  onOpen(e);
}

// opens the sidebar
function showSidebar() {
  const template = HtmlService.createTemplateFromFile('landing');
  const ui = template.evaluate().setTitle('MateriALL');
  DocumentApp.getUi().showSidebar(ui);
}

// includes file
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename)
      .getContent();
}

// global variable for storage
var userProperties = PropertiesService.getDocumentProperties();

// makes the worksheet from answer sheet
function makeWorkSheet() {
  var currDoc = DocumentApp.getActiveDocument();
  var currID = currDoc.getId();
  var file = DriveApp.getFileById(currID);
  var currName = file.getName()
  var source_folder = DriveApp.getFolderById(currID);
  var newFile = file.makeCopy('WorkSheet ' + currName + ' ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy.MM.dd 'at' HH:mm:ss z"));
  var newFileId = newFile.getId();
  var newURL = newFile.getUrl();
  var newDocBody = DocumentApp.openById(newFileId).getBody();
  newDocBody.replaceText("Your Added Questions", "Worksheet");
  newDocBody.replaceText("Instruction to convert to worksheet:.*$", "");
  newDocBody.replaceText("Answer:.*$", "Answer:\n");
  provideNewDocURL(newURL);
}

// gets the worksheet url
function provideNewDocURL(newURL) {
  var currDoc = DocumentApp.getActiveDocument();
  var style = {};
  style[DocumentApp.Attribute.FONT_SIZE] = 10;
  var instructionPar = currDoc.getBody().insertParagraph(1, "Worksheet for this answer key was generated. The link is:");
  instructionPar.setAttributes(style);
  var linkPar = currDoc.getBody().insertParagraph(2, `${newURL}\n`);
  linkPar.setAttributes(style);
  linkPar.setLinkUrl(newURL)
}

// inserts images to google doc
function insertImgToDoc() {
  var imgresult = JSON.parse(userProperties.getProperty('CHECKED_IMG'));
  var doc = DocumentApp.getActiveDocument();
  var body = doc.getBody();
  for (var i = 0; i < imgresult.length; i++) {
    var image = UrlFetchApp.fetch(imgresult[i]).getBlob();
    var currI = body.appendImage(image)
    currI.setWidth(currI.getWidth() * 0.3)
    currI.setHeight(currI.getHeight() * 0.3)
  }
}

// inserts content to google doc
function insertToDoc(res) {
  var value = res[0];
  var hasImage = res[1];
  var doc = DocumentApp.getActiveDocument();
  var body = doc.getBody();
  var isEmpty = true;
  for(var i = 0; i < body.getNumChildren();i++) {
    if(body.getChild(i).getText() != "") {
      isEmpty = false;
      break;
    }
  }  
  if (isEmpty) {
    var style = {};
    style[DocumentApp.Attribute.FONT_SIZE] = 10;
    var answerKeyTitle = body.insertParagraph(0, "Your Added Questions");
    var instructionText = body.insertParagraph(1, "Instruction to convert to worksheet: Please make sure you convert your answer key to a material! Go to the Google Docs toolbar --> Extensions --> MateriALL --> Convert Answer Key to Worksheet. This current document will become your answer key.");
    instructionText.setAttributes(style);
  }

  body.appendParagraph(value);
  
  if (hasImage) {
    insertImgToDoc();
  }
}

// ===== functions for all pages ===========================================

// gets new page content to generate
function newPage(page) {
  return HtmlService.createTemplateFromFile(page).evaluate().getContent();
}


// ===== functions for landing.html ========================================

// updates current slide url
function saveSlideID(url) {
  // delete previous stored slide first
  userProperties.deleteAllProperties();
  const myRe = /presentation\/d\/([a-zA-Z0-9-_]+)/;
  var presentationId = myRe.exec(url)[1];
  userProperties.setProperty('PRESENTATION_ID', presentationId);
  return true;
}

// ===== functions for loading.html ========================================

// gets slide with id and save slide
function saveAndGetSlide() {

  // gets slide id from url
  var presentationId = userProperties.getProperty('PRESENTATION_ID');
  var presentation = Slides.Presentations.get(presentationId);

  // saves slide content json
  var slides = presentation.slides;
  userProperties.setProperty('SLIDES', JSON.stringify(slides));

  // gets and save slide page id for each page
  for (let i = 0; i< slides.length; i++) {
    var currPageId = slides[i].objectId;
    var thumbnailJson = Slides.Presentations.Pages.getThumbnail(presentationId, currPageId, {"thumbnailProperties.thumbnailSize": "SMALL"});
    userProperties.setProperty(`${i}_thumbnail`, thumbnailJson.contentUrl);
  }

  // saves slide length
  userProperties.setProperty('TOTAL_PAGES', slides.length);

  slides.forEach((page, index) => {
    var currPageElements = page.pageElements;
    var currPageTexts = [];
    var currPageUrls = [];
    currPageElements.forEach((element) => {
      if (element.shape && element.shape.shapeType === "TEXT_BOX" && element.shape.text) {
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
  })
  return slides.length; 
}

// ===== functions for main.html ========================================

// gets elements for each slide page
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

// gets the total page amount for the slide
function getTotalPages() {
  var totalPages = userProperties.getProperty('TOTAL_PAGES');
  return totalPages;
}

// saves current selected elements
function saveClickedElements(checkedText, checkedImgUrl) {
  userProperties.setProperty('CHECKED_TEXT', checkedText);
  userProperties.setProperty('CHECKED_IMG', JSON.stringify(checkedImgUrl));
}


// ===== functions for modal.html ========================================

// shows dialog/modal
function showDialog() {
  var html = HtmlService.createTemplateFromFile('modal').evaluate()
      .setWidth(800)
      .setHeight(700);

  DocumentApp.getUi().showModalDialog(html, 'MateriALL Question Editor');
}

// get previously selected elements
function getCheckedData() {
  var checkedData = userProperties.getProperty('CHECKED_TEXT');
  var dataText = {"text": checkedData}
  var options = {
    'method' : 'post',
    'contentType': 'application/json',
    'payload' : JSON.stringify(dataText)
  };
  // backup API: "https://materiall.herokuapp.com/autogenerate"
  var response = UrlFetchApp.fetch("https://materiall.onrender.com/autogenerate", options);
  var result = JSON.parse(response.getContentText());

  var imgresult = JSON.parse(userProperties.getProperty('CHECKED_IMG'));

  return [result, imgresult]
}

// gets thumbnail for slides
function getThumbnailUrl() {
  var presentationId = userProperties.getProperty('PRESENTATION_ID');
  var currPage = parseInt(userProperties.getProperty('CURR_PAGE'), 10);
  var presentationPageIds = JSON.parse(userProperties.getProperty('PAGE_IDS'));
  var thumbnailJson = Slides.Presentations.Pages.getThumbnail(presentationId, presentationPageIds[currPage], {"thumbnailProperties.thumbnailSize": "SMALL"});
  return thumbnailJson.contentUrl;
}



