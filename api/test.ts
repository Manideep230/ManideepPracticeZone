export default function handler(req: any, res: any) {
  res.status(200).json({ status: 'ok', path: req.url, method: req.method });
}
