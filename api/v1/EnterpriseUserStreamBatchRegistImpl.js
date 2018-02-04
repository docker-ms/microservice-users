'use strict';

const CommonImport = require('../../util/CommonImport');
const ApiUtil = require('../../util/ApiUtil');

class EnterpriseUserStreamBatchRegistImpl {

  static enterpriseUserStreamBatchRegist(call, callback) {

    let lang;
    let companyInfo;

    let totalProcessed = 0;
    let succeed = 0;
    let failed = 0;

    let moreDetailsTitle;
    const moreDetails = [];
    const moreDetailsMsgBaseKey = 'EmailTpl.BatchRegistFeedback.FeedbackDetails';

    let isCompanyVerified = false;

    call.on('data', (reqData) => {
      if (!isCompanyVerified) {
        CommonImport.utils.bluebirdRetryExecutor(() => {
          const dbPool = CommonImport.utils.pickRandomly(global.DB_POOLS);
          const companiesCollection = dbPool.collection(global.RELATED_MONGODB_COLLECTIONS.companiesCollectionName);
          return companiesCollection.findOne({companyId: reqData.companyId}, {
            limit: 1,
            fields: {
              companyId: 1,
              companyName: 1,
              email: 1
            }
          });
        }, {}).then((res) => {
          if (!res) {
            return CommonImport.Promise.reject(new CommonImport.errors.InvalidField.InvalidCompanyId());
          } else {
            companyInfo = res;

            isCompanyVerified = true;

            _bulkInsert(reqData).then((isEnd) => {
              if (isEnd) {
                callback(null, {success: true});
              }
            }).catch((err) => {
              // Should have 0 chance coming here.
              CommonImport.utils.apiImplCommonErrorHandler(err, CommonImport.errors, callback);
            });
          }
        }).catch((err) => {
          CommonImport.utils.apiImplCommonErrorHandler(err, CommonImport.errors, callback);
        });

        lang = reqData.lang;

        moreDetailsTitle = CommonImport.i18n.i18nInternal.__({phrase: `${moreDetailsMsgBaseKey}.title`, locale: reqData.lang});
      } else {
        _bulkInsert(reqData).then((isEnd) => {
          if (isEnd) {
            callback(null, {success: true});
          }
        }).catch((err) => {
          // Should have 0 chance coming here.
          CommonImport.utils.apiImplCommonErrorHandler(err, CommonImport.errors, callback);
        });
      }
    });

    call.on('end', () => {
      // Nothing need to be done here.
    });

    const _bulkInsert = (reqData) => {
      // [{userId: {pwd: initialPwd, email: email, mobilePhoneNo: mobilePhoneNo}}]
      const pwds = [];
      // [hashedPwd]
      const getHashedPwds = [];

      const hash = CommonImport.Promise.promisify(CommonImport.bcrypt.hash);

      reqData.users.forEach((user) => {
        const pwd = CommonImport.shortid.generate();
        pwds.push({[`${CommonImport.shortid.generate()}`]: {
          pwd: pwd,
          email: user.email,
          mobilePhoneNo: user.mobilePhone && user.mobilePhone.mobilePhoneNoWithCountryCallingCode
        }});
        getHashedPwds.push(hash(pwd, 3));
      });

      const dbPool = CommonImport.utils.pickRandomly(global.DB_POOLS);
      const usersCollection = dbPool.collection(global.RELATED_MONGODB_COLLECTIONS.usersCollectionName);

      const bulkOps = [];

      return CommonImport.Promise.all(getHashedPwds).then((hashedPwds) => {
        reqData.users.forEach((user, idx) => {
          bulkOps.push({
            insertOne: {
              document: ApiUtil.prepareUserObj(user, reqData.companyId, Object.keys(pwds[idx])[0], hashedPwds[idx])
            }
          });
        });
        return usersCollection.bulkWrite(bulkOps, {ordered: false});
      }).then((bulkOpsRes) => {

        if (bulkOpsRes.nInserted === reqData.users.length) {

          // Send initial pwd to each user via email or SMS.
          pwds.forEach((item) => {
            let tmp = item[Object.keys(item)[0]];
            if (tmp.email) {
              CommonImport.utils.sendEmail(
                CommonImport.utils.pickRandomly(global.MAILER_POOL),
                tmp.email,
                reqData.lang,
                {
                  tplId: 'EmailTpl.DeliverInitialPwd',
                  subject: {},
                  htmlBody: {
                    USERNAME: tmp.email.substring(0, tmp.email.indexOf('@')),
                    INITIAL_PWD: tmp.pwd
                  }
                }
              );
            } else {
              // Email not provided, need to use SMS to send initial password.
            }
          });

          succeed += bulkOpsRes.nInserted;

        } else {

          const failedUserIds = [];

          bulkOpsRes.getWriteErrors().forEach((writeError) => {
            let errCode = writeError.code;
            let writeOp = writeError.getOperation();
            failedUserIds.push(writeOp.userId);
            if (errCode === 11000) {
              if (writeOp.email && writeOp.mobilePhone) {
                moreDetails.push(
                  CommonImport.i18n.i18nInternal.__({phrase: `${moreDetailsMsgBaseKey}.emailOrMobilePhoneNoTaken`, locale: reqData.lang}, {
                    REAL_NAME: writeOp.realName,
                    EMAIL: writeOp.email,
                    MOBILE_PHONE_NO: writeOp.mobilePhone.mobilePhoneNoWithCountryCallingCode
                  })
                );
              } else {
                if (writeOp.email) {
                  moreDetails.push(
                    CommonImport.i18n.i18nInternal.__({phrase: `${moreDetailsMsgBaseKey}.emailExisted`, locale: reqData.lang}, {
                      REAL_NAME: writeOp.realName,
                      EMAIL: writeOp.email
                    })
                  );
                } else {
                  moreDetails.push(
                    CommonImport.i18n.i18nInternal.__({phrase: `${moreDetailsMsgBaseKey}.mobilePhoneNoExisted`, locale: reqData.lang}, {
                      REAL_NAME: writeOp.realName,
                      MOBILE_PHONE_NO: writeOp.mobilePhone.mobilePhoneNoWithCountryCallingCode
                    })
                  );
                }
              }
            }
          });

          // Send initial pwd to success user via email or SMS.
          pwds.forEach((item) => {
            let tmpUserId = Object.keys(item)[0];
            if (failedUserIds.indexOf(tmpUserId) === -1) {
              let tmp = item[tmpUserId];
              if (tmp.email) {
                CommonImport.utils.sendEmail(
                  CommonImport.utils.pickRandomly(global.MAILER_POOL),
                  tmp.email,
                  reqData.lang,
                  {
                    tplId: 'EmailTpl.DeliverInitialPwd',
                    subject: {},
                    htmlBody: {
                      USERNAME: tmp.email.substring(0, tmp.email.indexOf('@')),
                      INITIAL_PWD: tmp.pwd
                    }
                  }
                );
              } else {
                // Email not provided, need to use SMS to send initial password.
              }
            }
          });

          failed += failedUserIds.length;
          succeed += (reqData.users.length - failed)

        }

        totalProcessed += reqData.users.length;

        if (totalProcessed === reqData.total) {
          _sendEmailFeedback();
          return CommonImport.Promise.resolve(true);
        } else {
          return CommonImport.Promise.resolve(false);
        }

      });
    };

    const _sendEmailFeedback = () => {
      if (moreDetails.length) {
        CommonImport.utils.sendEmail(
          CommonImport.utils.pickRandomly(global.MAILER_POOL),
          companyInfo.email,
          lang,
          {
            tplId: 'EmailTpl.BatchRegistFeedback',
            subject: {},
            htmlBody: {
              COMPANY_NAME: companyInfo.companyName,
              PROCESSED_NO: totalProcessed,
              SUCCESS_NO: succeed,
              FAIL_NO: failed,
              MORE_DETAILS: `${moreDetailsTitle}<ul>${moreDetails.join('')}</ul><br>`
            }
          }
        );
      } else {
        CommonImport.utils.sendEmail(
          CommonImport.utils.pickRandomly(global.MAILER_POOL),
          companyInfo.email,
          lang,
          {
            tplId: 'EmailTpl.BatchRegistFeedback',
            subject: {},
            htmlBody: {
              COMPANY_NAME: companyInfo.companyName,
              PROCESSED_NO: totalProcessed,
              SUCCESS_NO: succeed,
              FAIL_NO: 0
            }
          }
        );
      }
    };

  }

}

module.exports = EnterpriseUserStreamBatchRegistImpl;


