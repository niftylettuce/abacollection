const paginate = require('koa-ctx-paginate');
const Boom = require('@hapi/boom');
const isSANB = require('is-string-and-not-blank');
const { isISO8601 } = require('validator');

const { Clients } = require('../../../models');
const config = require('../../../../config');

async function list(ctx) {
  // TODO add limit to only allow them to see clients they have permissions for
  const [clients, itemCount] = await Promise.all([
    Clients.find({})
      .limit(ctx.query.limit)
      .skip(ctx.paginate.skip)
      .lean()
      .sort('last_name')
      .exec(),
    Clients.countDocuments({})
  ]);

  const pageCount = Math.ceil(itemCount / ctx.query.limit);

  await ctx.render('dashboard/clients', {
    clients,
    pageCount,
    itemCount,
    pages: paginate.getArrayPages(ctx)(3, pageCount, ctx.query.page)
  });
}

async function add_client(ctx) {
  if (
    !isSANB(ctx.request.body.first_name) ||
    !isSANB(ctx.request.body.last_name)
  )
    return ctx.throw(Boom.badRequest(ctx.translateError('INVALID_NAME')));

  if ( !isISO8601(ctx.request.body.dob))
    return ctx.throw(Boom.badRequest(ctx.translateError('INVALID_DOB')));

  // TODO add check for client already exsisting

  try {
    ctx.state.client = await Clients.create({
      first_name: ctx.request.body.first_name,
      last_name: ctx.request.body.last_name,
      dob: ctx.request.body.dob,
      gender: ctx.request.body.gender,
      created_by: ctx.state.user._id,
      creation_date: new Date(),
      members: [{ user: ctx.state.user._id, group: 'admin' }]
    });

    let redirectTo = '/dashboard/clients';

    ctx.flash('custom', {
      title: ctx.request.t('Success'),
      text: ctx.translate('REQUEST_OK'),
      type: 'success',
      toast: true,
      showConfirmButton: false,
      timer: 3000,
      position: 'top'
    });

    if (ctx.accepts('html')) ctx.redirect(redirectTo);
    else ctx.body = { redirectTo };
  } catch (err) {
    ctx.logger.error(err);
    ctx.throw(Boom.badRequest(err.message));
  }
}

async function retrieveClients(ctx, next) {
  ctx.state.clients = [];

  if (!ctx.isAuthenticated()) return next();

  const query = {
    $or: [{'members.user': ctx.state.user._id}]
  };

  ctx.state.clients = await Clients.find(query)
    .populate('members.user')
    .sort('last_name')
    .lean()
    .exec();

  return next();
}

module.exports = { list, add_client, retrieveClients };
