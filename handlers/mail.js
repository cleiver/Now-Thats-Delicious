const nodeMailer = require("nodemailer");
const pug = require("pug");
const juice = require("juice");
const html2Text = require("html-to-text");
const promisify = require("es6-promisify");

const transport = nodeMailer.createTransport({
  host: process.env.MAIL_HOST,
  port: process.env.MAIL_PORT,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  }
});

exports.send = async options => {
  const html = generateHTML(options.filename, options);
  const text = html2Text.fromString(html);
  const mailOptions = {
    from: `John Toe <no-reply@at.all`,
    to: options.user.email,
    subject: options.subject,
    html,
    text
  };

  const sendMail = promisify(transport.sendMail, transport);
  return sendMail(mailOptions);
};

const generateHTML = (filename, options = {}) => {
  const html = pug.renderFile(
    `${__dirname}/../views/email/${filename}.pug`,
    options
  );

  const inlined = juice(html);

  return inlined;
};
